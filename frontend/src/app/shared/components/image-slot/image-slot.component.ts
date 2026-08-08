import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Rounded, credited image container mirroring the source `<image-slot>`.
 * Lazy-loads by default (deferred, off-screen imagery) and exposes an
 * eager `priority` mode for above-the-fold hero art.
 */
@Component({
  selector: 'app-image-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="slot" [style.--radius.px]="radius()">
      <img
        class="slot__img"
        [src]="src()"
        [alt]="alt()"
        [loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
        decoding="async"
      />
      @if (credit()) {
        <figcaption class="slot__credit">
          <a [href]="creditHref()" target="_blank" rel="noopener noreferrer">{{ credit() }}</a>
        </figcaption>
      }
    </figure>
  `,
  styles: [
    `
      @use 'abstracts' as *;

      .slot {
        position: relative;
        width: 100%;
        height: 100%;
        margin: 0;
        border-radius: var(--radius, 14px);
        overflow: hidden;
      }

      .slot__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .slot__credit {
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        padding: 6px 8px;
        font-size: 9px;
        line-height: 1.2;
        color: rgba(255, 255, 255, 0.7);
        background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
        opacity: 0;
        transition: opacity $transition-base;
      }

      .slot:hover .slot__credit,
      .slot:focus-within .slot__credit {
        opacity: 1;
      }
    `,
  ],
})
export class ImageSlotComponent {
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly radius = input(14);
  readonly credit = input('');
  readonly creditHref = input('#');
  readonly priority = input(false, { transform: booleanAttribute });
}
