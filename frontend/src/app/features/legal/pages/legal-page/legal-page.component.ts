import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { environment } from '../../../../../environments/environment';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '../../data/legal-content';

/**
 * Privacy Policy and Terms and Conditions. The route `data.document` key
 * selects the copy; both pages share this layout.
 */
@Component({
  selector: 'app-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly document = input.required<LegalDocumentId>();

  protected readonly page = computed(() => LEGAL_DOCUMENTS[this.document()]);

  ngOnInit(): void {
    const page = this.page();
    const url = `${environment.appUrl}/${page.slug}`;
    this.seo.apply({
      title: page.title,
      description: page.description,
      url,
      canonical: url,
    });
    this.seo.setStructuredData(
      this.seo.breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: page.title, path: `/${page.slug}` },
      ]),
    );
  }
}
