import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { TimeoutError, catchError, firstValueFrom, of, retry, throwError, timeout, timer } from 'rxjs';
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

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
/** Templates that never send the ready handshake still get revealed after this. */
const FRAME_READY_FALLBACK_MS = 10000;

function isTransient(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
}

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
          <p class="inv-state__msg">Could not load this invitation. Please check your connection and try again.</p>
          <button type="button" class="inv-state__link" (click)="reload()">Try again</button>
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
    @if (state() === 'loading' || state() === 'ready') {
      <div
        class="inv-loader"
        [class.inv-loader--done]="state() === 'ready' && frameReady()"
        role="status"
        aria-live="polite"
        [attr.aria-hidden]="state() === 'ready' && frameReady() ? 'true' : null"
      >
        <div class="inv-loader__inner">
          <svg class="inv-loader__art" viewBox="0 0 120 84" aria-hidden="true">
            <defs>
              <linearGradient id="inv-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f8e7b0" />
                <stop offset="50%" stop-color="#d4af37" />
                <stop offset="100%" stop-color="#9a7514" />
              </linearGradient>
            </defs>
            <circle class="inv-loader__track" cx="46" cy="50" r="24" />
            <circle class="inv-loader__track" cx="74" cy="50" r="24" />
            <circle class="inv-loader__ring inv-loader__ring--left" cx="46" cy="50" r="24" />
            <circle class="inv-loader__ring inv-loader__ring--right" cx="74" cy="50" r="24" />
            <path class="inv-loader__gem" d="M60 4 62.4 10.6 69 13 62.4 15.4 60 22 57.6 15.4 51 13 57.6 10.6Z" />
          </svg>
          <span class="inv-loader__line" aria-hidden="true"></span>
          <span class="inv-sr-only">Loading invitation</span>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      position: relative;
      display: block;
      width: 100vw;
      height: 100vh;
      background: #0e0102;
    }
    /* ---------- loader: two interlocking gold rings ---------- */
    .inv-loader {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% 46%, #2a0a0c 0%, #0e0102 62%);
      transition: opacity 0.7s ease, visibility 0s linear 0.7s;
    }
    .inv-loader--done {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .inv-loader__inner {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      /* Delay so fast loads never flash the loader. */
      opacity: 0;
      animation: inv-fade-in 0.6s ease 0.15s forwards;
    }
    .inv-loader__inner::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 280px;
      height: 280px;
      margin: -160px 0 0 -140px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.16), transparent 65%);
      animation: inv-glow 2.8s ease-in-out infinite;
      pointer-events: none;
    }
    .inv-loader__art {
      position: relative;
      width: clamp(132px, 16vw, 176px);
      height: auto;
      overflow: visible;
    }
    .inv-loader__track {
      fill: none;
      stroke: rgba(212, 175, 55, 0.22);
      stroke-width: 1.6;
    }
    .inv-loader__ring {
      fill: none;
      stroke: url(#inv-gold);
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-dasharray: 151;
      stroke-dashoffset: 151;
      transform-box: fill-box;
      transform-origin: center;
      filter: drop-shadow(0 0 3px rgba(212, 175, 55, 0.45));
      animation: inv-draw 2.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    }
    .inv-loader__ring--left { transform: rotate(-90deg); }
    .inv-loader__ring--right { transform: rotate(90deg) scaleX(-1); animation-delay: 0.35s; }
    .inv-loader__gem {
      fill: #f8e7b0;
      transform-box: fill-box;
      transform-origin: center;
      filter: drop-shadow(0 0 4px rgba(248, 231, 176, 0.8));
      animation: inv-twinkle 2.8s ease-in-out infinite;
    }
    .inv-loader__line {
      width: clamp(110px, 13vw, 150px);
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4) 20%, #fff3cf 50%, rgba(212, 175, 55, 0.4) 80%, transparent);
      background-size: 200% 100%;
      animation: inv-shimmer 2.8s ease-in-out infinite;
    }
    .inv-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @keyframes inv-draw {
      0% { stroke-dashoffset: 151; opacity: 0.35; }
      45%, 60% { stroke-dashoffset: 0; opacity: 1; }
      100% { stroke-dashoffset: -151; opacity: 0.35; }
    }
    @keyframes inv-twinkle {
      0%, 100% { transform: scale(0.55) rotate(0deg); opacity: 0.35; }
      50% { transform: scale(1) rotate(45deg); opacity: 1; }
    }
    @keyframes inv-glow {
      0%, 100% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.08); opacity: 1; }
    }
    @keyframes inv-shimmer {
      0% { background-position: 150% 0; }
      100% { background-position: -50% 0; }
    }
    @keyframes inv-fade-in {
      to { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .inv-loader__ring { animation: none; stroke-dashoffset: 0; }
      .inv-loader__gem, .inv-loader__line, .inv-loader__inner::before { animation-duration: 6s; }
    }
    button.inv-state__link {
      background: transparent;
      font: inherit;
      cursor: pointer;
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
  /** True once the template iframe has received the invitation data. */
  protected readonly frameReady = signal(false);

  private frameEl: HTMLIFrameElement | null = null;
  private pendingData: Record<string, unknown> | null = null;
  private isReady = false;

  protected reload(): void {
    this.window?.location.reload();
  }

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
          timeout(REQUEST_TIMEOUT_MS),
          // Keep showing the loader through transient failures (backend restarting,
          // flaky network, slow cold start) instead of flashing an error.
          retry({
            count: MAX_RETRIES,
            delay: (err, attempt) =>
              isTransient(err) ? timer(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)) : throwError(() => err),
          }),
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
        this.frameReady.set(true);
      }
    };
    this.window?.addEventListener('message', onMessage);
    const fallback = this.window?.setTimeout(() => this.frameReady.set(true), FRAME_READY_FALLBACK_MS);
    this.destroyRef.onDestroy(() => {
      this.window?.removeEventListener('message', onMessage);
      this.window?.clearTimeout(fallback);
    });

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
