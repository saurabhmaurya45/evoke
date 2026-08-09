import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { TemplateEditorStore } from '../../data/template-editor.store';
import { WINDOW } from '../../../../core/tokens/window.token';
import { PREVIEW_PROTOCOL_VERSION, PREVIEW_READY, PREVIEW_UPDATE } from '../../data/preview-protocol';

/** A previewable device viewport. `fit` fills the pane (no device frame). */
interface DevicePreset {
  readonly id: 'fit' | 'mobile' | 'tablet' | 'laptop';
  readonly label: string;
  /** CSS-pixel viewport; `null` for the responsive `fit` mode. */
  readonly width: number | null;
  readonly height: number | null;
}

const DEVICES: readonly DevicePreset[] = [
  { id: 'fit', label: 'Fit', width: null, height: null },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
  { id: 'tablet', label: 'Tablet', width: 820, height: 1180 },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
];

/**
 * Live preview: embeds the template's real rendered HTML in an iframe and
 * streams the editor's {@link TemplateData} into it via `postMessage`, so the
 * preview is the genuine design *and* updates as the user types.
 *
 * A device toolbar reframes the same iframe at true mobile / tablet / laptop
 * viewports (scaled to fit the available space), and an expand control shows it
 * full screen — so responsive behaviour can be checked live, docked or expanded.
 */
@Component({
  selector: 'app-template-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (safeSrc(); as src) {
      <div class="preview">
        <div class="preview__bar">
          <div class="preview__devices" role="group" aria-label="Preview device">
            @for (device of devices; track device.id) {
              <button
                type="button"
                class="preview__device-btn"
                [class.preview__device-btn--active]="deviceId() === device.id"
                [attr.aria-pressed]="deviceId() === device.id"
                (click)="deviceId.set(device.id)"
              >
                {{ device.label }}
              </button>
            }
          </div>

          <button
            type="button"
            class="preview__expand"
            [attr.aria-label]="isFullscreen() ? 'Exit full screen' : 'Expand preview to full screen'"
            [title]="isFullscreen() ? 'Exit full screen' : 'Full screen'"
            (click)="toggleFullscreen()"
          >
            @if (isFullscreen()) {
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6" />
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
              </svg>
            }
          </button>
        </div>

        <div class="preview__stage" #stage>
          <div
            class="preview__viewport"
            [class.preview__viewport--framed]="deviceId() !== 'fit'"
            [style.width]="viewportStyle().width"
            [style.height]="viewportStyle().height"
            [style.transform]="viewportStyle().transform"
          >
            <iframe
              #frame
              class="preview__frame"
              [src]="src"
              title="Live invitation preview"
              referrerpolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin"
            ></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .preview {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #120303;
      }
      .preview__bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.65rem;
        border-bottom: 1px solid rgba(212, 175, 55, 0.25);
      }
      .preview__devices {
        display: flex;
        gap: 0.2rem;
        margin: 0 auto;
        padding: 0.2rem;
        border-radius: 0.55rem;
        background: rgba(212, 175, 55, 0.08);
      }
      .preview__device-btn {
        font: inherit;
        font-size: 0.78rem;
        color: #fdf6e3;
        padding: 0.32rem 0.8rem;
        border: none;
        border-radius: 0.4rem;
        background: transparent;
        cursor: pointer;
        opacity: 0.75;
        transition:
          background 0.2s ease,
          opacity 0.2s ease;
      }
      .preview__device-btn:hover {
        opacity: 1;
      }
      .preview__device-btn--active {
        opacity: 1;
        background: rgba(212, 175, 55, 0.28);
      }
      .preview__expand {
        display: grid;
        place-items: center;
        width: 2.2rem;
        height: 2.2rem;
        padding: 0;
        border-radius: 0.55rem;
        cursor: pointer;
        color: #fdf6e3;
        border: 1px solid rgba(212, 175, 55, 0.5);
        background: rgba(26, 4, 5, 0.6);
        transition:
          background 0.2s ease,
          transform 0.2s ease;
      }
      .preview__expand:hover {
        background: rgba(212, 175, 55, 0.25);
        transform: translateY(-1px);
      }
      .preview__device-btn:focus-visible,
      .preview__expand:focus-visible {
        outline: 2px solid #d4af37;
        outline-offset: 2px;
      }
      .preview__stage {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      .preview__viewport {
        position: absolute;
        top: 50%;
        left: 50%;
        transform-origin: center center;
      }
      .preview__viewport--framed {
        border-radius: 1.1rem;
        box-shadow:
          0 0 0 8px #0a0203,
          0 0 0 10px rgba(212, 175, 55, 0.4),
          0 18px 60px rgba(0, 0, 0, 0.55);
        overflow: hidden;
      }
      .preview__frame {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #1a0405;
      }
    `,
  ],
})
export class TemplateRendererComponent {
  private readonly store = inject(TemplateEditorStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly devices = DEVICES;

  private ready = false;

  /** Selected device viewport. */
  protected readonly deviceId = signal<DevicePreset['id']>('fit');
  /** Whether the preview is currently expanded to full screen. */
  protected readonly isFullscreen = signal(false);
  /** Available stage size, tracked so device frames scale to fit. */
  private readonly stageSize = signal({ width: 0, height: 0 });

  protected readonly safeSrc = computed<SafeResourceUrl | null>(() => {
    const url = this.store.schema()?.previewUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  /** Size + scale transform for the viewport wrapper, per selected device. */
  protected readonly viewportStyle = computed(() => {
    const device = DEVICES.find((d) => d.id === this.deviceId()) ?? DEVICES[0];
    if (device.width === null || device.height === null) {
      return { width: '100%', height: '100%', transform: 'translate(-50%, -50%)' };
    }
    const stage = this.stageSize();
    // Shrink (never enlarge) so the full device viewport fits with a margin.
    const scale = Math.min(
      1,
      (stage.width * 0.92) / device.width,
      (stage.height * 0.92) / device.height,
    );
    return {
      width: `${device.width}px`,
      height: `${device.height}px`,
      transform: `translate(-50%, -50%) scale(${scale || 1})`,
    };
  });

  constructor() {
    // The embedded template signals readiness before it can accept data.
    const onMessage = (event: MessageEvent): void => {
      const message = event.data as { channel?: string; version?: number } | null;
      const frameWindow = this.frame()?.nativeElement.contentWindow;
      const sameOrigin = event.origin === this.window?.location.origin;
      if (
        sameOrigin &&
        event.source === frameWindow &&
        message?.channel === PREVIEW_READY &&
        message.version === PREVIEW_PROTOCOL_VERSION
      ) {
        this.ready = true;
        this.push();
      }
    };
    this.window?.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(() => this.window?.removeEventListener('message', onMessage));

    // Keep the icon in sync with the browser's fullscreen state (Esc, etc.).
    const onFsChange = (): void => this.isFullscreen.set(!!this.window?.document.fullscreenElement);
    this.window?.document.addEventListener('fullscreenchange', onFsChange);
    this.destroyRef.onDestroy(() =>
      this.window?.document.removeEventListener('fullscreenchange', onFsChange),
    );

    // Track the stage size so device frames scale to whatever space is free
    // (docked pane or full screen).
    afterNextRender(() => this.observeStage());

    // A new template resets the handshake until its iframe re-announces ready.
    effect(() => {
      this.safeSrc();
      this.ready = false;
    });

    // Push data on every edit (no-op until the iframe is ready).
    effect(() => {
      this.store.data();
      this.push();
    });
  }

  /** Expand the preview to full screen, or exit if already expanded. */
  protected toggleFullscreen(): void {
    const doc = this.window?.document;
    if (!doc) {
      return;
    }
    if (doc.fullscreenElement) {
      void doc.exitFullscreen();
    } else {
      void this.host.nativeElement.requestFullscreen?.();
    }
  }

  private observeStage(): void {
    const el = this.stage()?.nativeElement;
    if (!el || !this.window || !('ResizeObserver' in this.window)) {
      return;
    }
    const observer = new ResizeObserver(() =>
      this.stageSize.set({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    this.stageSize.set({ width: el.clientWidth, height: el.clientHeight });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private push(): void {
    if (!this.ready) {
      return;
    }
    this.frame()?.nativeElement.contentWindow?.postMessage(
      { channel: PREVIEW_UPDATE, version: PREVIEW_PROTOCOL_VERSION, data: this.store.data() },
      this.window?.location.origin ?? '*',
    );
  }
}
