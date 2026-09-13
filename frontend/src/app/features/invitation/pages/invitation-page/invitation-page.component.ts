import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { catchError, firstValueFrom, of } from 'rxjs';
import { TemplateSchemaLoader } from '../../../editor/data/template-schema.loader';
import { WINDOW } from '../../../../core/tokens/window.token';
import { PREVIEW_PROTOCOL_VERSION, PREVIEW_READY, PREVIEW_UPDATE } from '../../../editor/data/preview-protocol';

interface InvitationApiOut {
  eventId: string;
  slug: string;
  title: string;
  status: string;
  ownerId: string;
  templateSlotId: string | null;
  draftData: Record<string, unknown>;
  schemaVersion: number | null;
}

type PageState = 'loading' | 'ready' | 'draft-forbidden' | 'not-found' | 'error';

/**
 * Public/owner-only invitation viewer. Loads the invitation from the backend by
 * slug, resolves the template's previewUrl locally, then renders the filled-in
 * design full-screen in an iframe using the same postMessage protocol as the editor.
 *
 * - DRAFT: only the signed-in owner can view.
 * - PUBLISHED: visible to everyone.
 */
@Component({
  selector: 'app-invitation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="inv-state">
          <p class="inv-state__msg">Loading invitation…</p>
        </div>
      }
      @case ('not-found') {
        <div class="inv-state">
          <h1 class="inv-state__title">Not found</h1>
          <p class="inv-state__msg">This invitation doesn't exist or has been removed.</p>
        </div>
      }
      @case ('draft-forbidden') {
        <div class="inv-state">
          <h1 class="inv-state__title">Sign in to preview</h1>
          <p class="inv-state__msg">This invitation is a private draft. Sign in as the owner to view it.</p>
          <a class="inv-state__link" href="/login">Sign in</a>
        </div>
      }
      @case ('error') {
        <div class="inv-state">
          <h1 class="inv-state__title">Something went wrong</h1>
          <p class="inv-state__msg">Could not load this invitation. Please try again later.</p>
        </div>
      }
      @case ('ready') {
        @if (safeSrc()) {
          <iframe
            class="inv-frame"
            [src]="safeSrc()!"
            title="Invitation"
            referrerpolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin"
          ></iframe>
        }
      }
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      background: #0e0102;
    }
    .inv-frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .inv-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 1rem;
      padding: 2rem;
      text-align: center;
      color: #fdf6e3;
      font-family: inherit;
    }
    .inv-state__title {
      font-size: 1.75rem;
      font-weight: 600;
      margin: 0;
    }
    .inv-state__msg {
      margin: 0;
      opacity: 0.7;
    }
    .inv-state__link {
      color: #d4af37;
      text-decoration: none;
      border: 1px solid #d4af37;
      padding: 0.5rem 1.5rem;
      border-radius: 2rem;
      margin-top: 0.5rem;
      transition: background 0.2s;
    }
    .inv-state__link:hover {
      background: rgba(212, 175, 55, 0.15);
    }
  `],
})
export class InvitationPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly loader = inject(TemplateSchemaLoader);
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input('');

  protected readonly state = signal<PageState>('loading');
  protected readonly safeSrc = signal<SafeResourceUrl | null>(null);

  private frameEl: HTMLIFrameElement | null = null;
  private pendingData: Record<string, unknown> | null = null;
  private isReady = false;

  async ngOnInit(): Promise<void> {
    const slug = this.slug();
    if (!slug) {
      this.state.set('not-found');
      return;
    }

    let invitation: InvitationApiOut | null = null;
    try {
      invitation = await firstValueFrom(
        this.http.get<InvitationApiOut>(`v1/i/${slug}`).pipe(
          catchError((err: { status?: number }) => {
            if (err.status === 401 || err.status === 403) {
              this.state.set('draft-forbidden');
            } else if (err.status === 404) {
              this.state.set('not-found');
            } else {
              this.state.set('error');
            }
            return of(null);
          }),
        ),
      );
    } catch {
      this.state.set('error');
      return;
    }

    if (!invitation) return;

    const templateId = invitation.templateSlotId;
    if (!templateId) {
      this.state.set('error');
      return;
    }

    const schema = await this.loader.load(templateId);
    if (!schema) {
      this.state.set('error');
      return;
    }

    this.pendingData = invitation.draftData;
    this.safeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(schema.previewUrl));
    this.state.set('ready');

    // Listen for the iframe's PREVIEW_READY handshake, then push the data once.
    // Verify both origin AND source to prevent any same-origin script from
    // spoofing the ready signal and triggering a data push to the wrong window.
    const onMessage = (event: MessageEvent): void => {
      const msg = event.data as { channel?: string; version?: number } | null;
      const frameWindow = this.frameEl?.contentWindow ??
        (this.window?.document.querySelector('iframe.inv-frame') as HTMLIFrameElement | null)?.contentWindow;
      if (
        event.origin === this.window?.location.origin &&
        event.source === frameWindow &&
        msg?.channel === PREVIEW_READY &&
        msg.version === PREVIEW_PROTOCOL_VERSION &&
        !this.isReady
      ) {
        this.isReady = true;
        this.pushData();
      }
    };
    this.window?.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(() => this.window?.removeEventListener('message', onMessage));

    // Grab the iframe reference after the next render cycle so it's available
    // when the PREVIEW_READY message arrives.
    setTimeout(() => {
      this.frameEl = this.window?.document.querySelector('iframe.inv-frame') ?? null;
    }, 0);
  }

  private pushData(): void {
    const frameWindow =
      this.frameEl?.contentWindow ??
      (this.window?.document.querySelector('iframe.inv-frame') as HTMLIFrameElement | null)
        ?.contentWindow;
    if (!frameWindow || !this.pendingData) return;
    frameWindow.postMessage(
      { channel: PREVIEW_UPDATE, version: PREVIEW_PROTOCOL_VERSION, data: this.pendingData },
      this.window?.location.origin ?? '*',
    );
  }
}
