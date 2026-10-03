import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { environment } from '../../../../../environments/environment';
import { APP_LOGO_PATH, APP_NAME } from '../../../../core/constants/app.constants';
import { DEFAULT_OG_IMAGE } from '../../../../core/constants/og-image.constants';
import { BLOG_POSTS, blogPostBySlug } from '../../data/blog-posts.data';
import { TemplateStripComponent } from '../../../templates/components/template-strip/template-strip.component';
import { NotFoundComponent } from '../../../../shared/components/not-found/not-found.component';

/** /blog/:slug — a single article with BlogPosting + BreadcrumbList markup. */
@Component({
  selector: 'app-blog-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TemplateStripComponent, NotFoundComponent],
  templateUrl: './blog-post.component.html',
  styleUrl: '../../../../shared/styles/content-page.scss',
})
export class BlogPostComponent {
  private readonly seo = inject(SeoService);

  readonly slug = input('');

  protected readonly post = computed(() => blogPostBySlug(this.slug()));
  protected readonly others = computed(() =>
    BLOG_POSTS.filter((p) => p.slug !== this.slug()).slice(0, 3),
  );

  constructor() {
    effect(() => {
      const post = this.post();
      if (!post) return;
      const url = `${environment.appUrl}/blog/${post.slug}`;
      this.seo.apply({
        title: post.title,
        description: post.description,
        keywords: post.keywords,
        url,
        type: 'article',
      });
      this.seo.setStructuredData([
        {
          '@type': 'BlogPosting',
          '@id': `${url}#article`,
          mainEntityOfPage: url,
          headline: post.title,
          description: post.description,
          keywords: post.keywords.join(', '),
          datePublished: post.published,
          dateModified: post.published,
          inLanguage: 'en-IN',
          image: DEFAULT_OG_IMAGE.url,
          author: { '@type': 'Organization', name: APP_NAME, url: environment.appUrl },
          publisher: {
            '@type': 'Organization',
            '@id': `${environment.appUrl}/#organization`,
            name: APP_NAME,
            logo: { '@type': 'ImageObject', url: `${environment.appUrl}${APP_LOGO_PATH}` },
          },
        },
        this.seo.breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ]),
      ]);
    });
  }
}
