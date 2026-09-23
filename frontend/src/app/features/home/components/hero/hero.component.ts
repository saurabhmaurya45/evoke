import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type AfterViewChecked,
  type AfterViewInit,
  type ElementRef,
  computed,
  inject,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MagneticDirective } from '../../../../shared/directives/magnetic.directive';
import { ViewportService } from '../../../../core/services/viewport.service';
import { WINDOW } from '../../../../core/tokens/window.token';
import { HomeContentService } from '../../data/home-content.service';

/**
 * Hero: scroll-driven parallax blobs and cursor-driven floating preview cards
 * over the app-wide Three.js backdrop (provided globally by the shell).
 * Parallax reads the shared scroll signal (no local listener).
 */
@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MagneticDirective, RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent implements AfterViewInit, AfterViewChecked {
  private readonly viewport = inject(ViewportService);
  private readonly window = inject(WINDOW);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly content = inject(HomeContentService);

  /** Media corner radius, one shared value now that all four card shells
   * share the same outer radius ($radius-lg, see hero.component.scss). */
  protected readonly cardRadii = [12, 12, 12, 12];

  private readonly floatCards = viewChildren<ElementRef<HTMLElement>>('floatCard');
  private readonly cardVideos = viewChildren<ElementRef<HTMLVideoElement>>('vid');
  private readonly startedVideos = new WeakSet<HTMLVideoElement>();

  protected readonly parallax1 = computed(() => this.viewport.scrollY() * 0.1);
  protected readonly parallax2 = computed(() => this.viewport.scrollY() * 0.06);
  protected readonly parallax3 = computed(() => this.viewport.scrollY() * 0.14);

  /** Gates play attempts until the post-hydration nudge burst (below) has finished. */
  private settled = false;

  ngAfterViewInit(): void {
    // The hero renders in the server-sent HTML (unlike the deferred, client-only
    // templates carousel). Hydration re-applies bound attributes (incl. the
    // <source src>) once on the client even when unchanged, which the browser
    // treats as a new media resource and aborts any play() already in flight for it
    // ("AbortError: the media was removed from the document") — and every
    // markForCheck below is itself another re-application, so attempting play()
    // *during* this burst would just keep re-triggering the same abort. Let the
    // burst run undisturbed first (forcing whatever re-applications are coming to
    // happen now), then make one clean attempt per video afterward, once nothing is
    // left to interrupt it.
    let ticks = 0;
    const id = setInterval(() => {
      this.cdr.markForCheck();
      if (++ticks < 10) return;
      clearInterval(id);
      this.settled = true;
      this.cdr.markForCheck();
    }, 100);
  }

  ngAfterViewChecked(): void {
    if (!this.settled) return;
    for (const { nativeElement } of this.cardVideos()) {
      if (this.startedVideos.has(nativeElement) || typeof nativeElement.play !== 'function') {
        continue;
      }
      this.startedVideos.add(nativeElement);
      nativeElement.muted = true;
      void nativeElement.play().catch(() => {});
    }
  }

  private get reducedMotion(): boolean {
    return this.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  protected onPointerMove(event: MouseEvent, host: HTMLElement): void {
    if (this.reducedMotion) {
      return;
    }
    const rect = host.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    this.floatCards().forEach((ref, i) => {
      const factor = (i + 1) * 10;
      ref.nativeElement.style.transform = `translate(${x * -factor}px, ${y * -factor}px)`;
    });
  }
}
