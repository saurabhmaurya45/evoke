import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TemplateCatalogService } from '../../data/template-catalog.service';
import { templateSeoBySlotId } from '../../data/template-seo.data';

/**
 * Grid of template cards linking to each template's own page. Used by the
 * landing pages, template pages and blog posts — the internal links that pass
 * ranking signal to /templates/:slug.
 *
 * `first` sets the order: listed templates lead, the rest follow. With
 * `only`, just the listed ones are shown — community pages use this so they
 * don't each repeat the full catalogue (and link to it instead).
 */
@Component({
  selector: 'app-template-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <ul class="strip">
      @for (item of items(); track item.slotId) {
        <li>
          <a class="strip__card" [routerLink]="['/templates', item.slug]">
            <img
              class="strip__img"
              [src]="item.poster"
              [alt]="item.name + ' — ' + item.label + ' invitation website template'"
              width="560"
              height="316"
              loading="lazy"
              decoding="async"
            />
            <span class="strip__label">{{ item.label }}</span>
            <span class="strip__name">{{ item.name }}</span>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: './template-strip.component.scss',
})
export class TemplateStripComponent {
  private readonly catalog = inject(TemplateCatalogService);

  /** slotIds to show first. */
  readonly first = input<readonly string[]>([]);
  /** Show only the `first` templates instead of the whole catalogue. */
  readonly only = input(false);
  /** slotIds to leave out (e.g. the template whose page this is). */
  readonly exclude = input<readonly string[]>([]);

  protected readonly items = computed(() => {
    const first = this.first();
    const exclude = new Set(this.exclude());
    const only = this.only();
    const rank = (slotId: string) => {
      const i = first.indexOf(slotId);
      return i === -1 ? first.length : i;
    };
    return this.catalog
      .published()
      .filter((tpl) => !exclude.has(tpl.slotId) && (!only || first.includes(tpl.slotId)))
      .map((tpl) => ({ tpl, seo: templateSeoBySlotId(tpl.slotId) }))
      .filter((x): x is { tpl: typeof x.tpl; seo: NonNullable<typeof x.seo> } => !!x.seo)
      .sort((a, b) => rank(a.tpl.slotId) - rank(b.tpl.slotId))
      .map(({ tpl, seo }) => ({
        slotId: tpl.slotId,
        slug: seo.slug,
        name: tpl.name,
        label: seo.label,
        poster: tpl.previewPoster ?? tpl.photo,
      }));
  });
}
