import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, type CatalogTemplate } from '../../data/template-catalog.service';
import { templateSeoBySlotId } from '../../data/template-seo.data';
import { whatsappLink } from '../../../../core/constants/app.constants';

/**
 * Phone-shaped template card: the template's real opening recorded on a phone,
 * its tradition label, name and price, Preview / Use, and a WhatsApp enquiry
 * pre-filled with the template's name. Used by the homepage carousel and the
 * /templates gallery.
 *
 * The clip plays only while at least half of it is on screen, so a page full
 * of cards never has every video running at once.
 */
@Component({
  selector: 'app-template-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './template-card.component.html',
  styleUrl: './template-card.component.scss',
})
export class TemplateCardComponent {
  readonly template = input.required<CatalogTemplate>();
  /** Prices render only once they come from the backend — never the ₹0 seed. */
  readonly showPrice = input(false);
  /** Heading level of the name — 3 under a section heading, 2 directly under a page h1. */
  readonly headingLevel = input<2 | 3>(3);

  private readonly destroyRef = inject(DestroyRef);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('vid');

  private readonly seo = computed(() => templateSeoBySlotId(this.template().slotId));
  /** URL slug of the template's own page. */
  protected readonly slug = computed(() => this.seo()?.slug ?? '');
  /** Tradition label, e.g. "Sikh Wedding" — falls back to the category. */
  protected readonly label = computed(() => this.seo()?.label ?? this.template().category);
  /** Name without its descriptor: "Royal Gate — Sikh Wedding" → "Royal Gate". */
  protected readonly shortName = computed(() => this.template().name.split(' — ')[0]);
  protected readonly price = computed(() => formatPrice(this.template()));
  /** WhatsApp chat with support, pre-filled with the template being asked about. */
  protected readonly whatsapp = computed(() =>
    whatsappLink(`Hi, I'm interested in the ${this.template().name} template on theinvitely.in`),
  );

  constructor() {
    // After the first client render, so hydration has finished touching the
    // <video> before we ask it to play. Browser only — never runs on the server.
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const video = this.video().nativeElement;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            video.muted = true;
            video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        },
        { threshold: 0.5 },
      );
      observer.observe(video);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
