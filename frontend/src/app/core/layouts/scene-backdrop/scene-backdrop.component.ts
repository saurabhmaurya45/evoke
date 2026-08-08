import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { ViewportService } from '../../services/viewport.service';
import { WINDOW } from '../../tokens/window.token';
import { RingsScene } from '../../../shared/graphics/rings-scene';
import { ThemeService } from '../../services/theme.service';

/**
 * Global Three.js backdrop rendered once behind the entire application. A
 * single fixed, transparent WebGL canvas shows the gold wedding rings through
 * every (transparent) section, so the whole site shares one cohesive 3D
 * parallax layer instead of a canvas per section.
 *
 * Performance & safety:
 * - Browser-only init (`afterNextRender`) — SSR-safe.
 * - One rAF loop, paused when the tab is hidden.
 * - Pixel ratio capped; size driven by the viewport signals.
 * - `prefers-reduced-motion` → one static frame, no loop.
 * - Fails silently if WebGL is unavailable.
 * - All GPU resources / listeners released on destroy.
 */
@Component({
  selector: 'app-scene-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="backdrop" aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 0;
        display: block;
        pointer-events: none;
        // Keep the composition readable behind text: fade the edges.
        mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 60%, transparent);
        -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 40%, black 60%, transparent);
        opacity: 0.85;
      }
      .backdrop {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class SceneBackdropComponent {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly viewport = inject(ViewportService);
  private readonly window = inject(WINDOW);
  private readonly destroyRef = inject(DestroyRef);
  private readonly theme = inject(ThemeService);

  private scene?: RingsScene;
  private rafId = 0;
  private running = false;
  private prevTime = 0;
  private pointerX = 0;
  private pointerY = 0;

  constructor() {
    afterNextRender(() => this.init());
  }

  private init(): void {
    const win = this.window;
    const canvas = this.canvasRef().nativeElement;
    if (!win) {
      return;
    }

    const width = win.innerWidth;
    const height = win.innerHeight;

    try {
      this.scene = new RingsScene(canvas, width, height, win.devicePixelRatio || 1);
      this.scene.setTheme(this.theme.theme());
    } catch {
      return;
    }

    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.scene.renderStatic();
      this.bindResize(win);
      return;
    }

    this.bindResize(win);
    this.bindTheme(win);
    this.bindVisibility(win);
    this.bindPointer(win);
    this.start(win);

    this.destroyRef.onDestroy(() => this.teardown());
  }

  private bindTheme(win: Window): void {
    const observer = new MutationObserver(() => this.scene?.setTheme(this.theme.theme()));
    observer.observe(win.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private start(win: Window): void {
    if (this.running || !this.scene) {
      return;
    }
    this.running = true;
    this.prevTime = win.performance.now();
    const loop = (now: number): void => {
      if (!this.running || !this.scene) {
        return;
      }
      const delta = Math.min((now - this.prevTime) / 1000, 0.1);
      this.prevTime = now;
      this.scene.setParallax(this.pointerX, this.pointerY, this.scrollProgress(win));
      this.scene.render(now / 1000, delta);
      this.rafId = win.requestAnimationFrame(loop);
    };
    this.rafId = win.requestAnimationFrame(loop);
  }

  private stop(): void {
    this.running = false;
    this.window?.cancelAnimationFrame(this.rafId);
  }

  /** Page scroll fraction (0 at top, 1 at the bottom of the document). */
  private scrollProgress(win: Window): number {
    const doc = win.document.documentElement;
    const max = doc.scrollHeight - win.innerHeight;
    // Touch the scroll signal so width/scroll changes keep this fresh.
    const y = this.viewport.scrollY();
    return max > 0 ? Math.min(y / max, 1) : 0;
  }

  private bindResize(win: Window): void {
    const onResize = (): void => {
      this.scene?.resize(win.innerWidth, win.innerHeight);
      if (!this.running) {
        this.scene?.renderStatic();
      }
    };
    win.addEventListener('resize', onResize, { passive: true });
    this.destroyRef.onDestroy(() => win.removeEventListener('resize', onResize));
  }

  private bindVisibility(win: Window): void {
    const onVisibility = (): void => {
      if (win.document.visibilityState === 'hidden') {
        this.stop();
      } else {
        this.start(win);
      }
    };
    win.document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() =>
      win.document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  private bindPointer(win: Window): void {
    const onMove = (event: PointerEvent): void => {
      this.pointerX = event.clientX / win.innerWidth - 0.5;
      this.pointerY = event.clientY / win.innerHeight - 0.5;
    };
    win.addEventListener('pointermove', onMove, { passive: true });
    this.destroyRef.onDestroy(() => win.removeEventListener('pointermove', onMove));
  }

  private teardown(): void {
    this.stop();
    this.scene?.dispose();
    this.scene = undefined;
  }
}
