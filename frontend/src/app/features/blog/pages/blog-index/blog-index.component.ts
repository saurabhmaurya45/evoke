import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../core/services/seo.service';
import { environment } from '../../../../../environments/environment';
import { BLOG_POSTS } from '../../data/blog-posts.data';

/** /blog — lists every post, newest first. */
@Component({
  selector: 'app-blog-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="page page--narrow">
      <nav aria-label="Breadcrumb">
        <ol class="crumbs">
          <li><a routerLink="/">Home</a></li>
          <li aria-current="page">Blog</li>
        </ol>
      </nav>
      <p class="eyebrow">Blog</p>
      <h1 class="title">Wedding Invitation Wording, Ideas &amp; Guides</h1>
      <p class="intro">
        Copy-ready invitation wording in English, Hindi and Punjabi, WhatsApp etiquette, and ideas
        for every function from haldi to reception.
      </p>

      <ul class="posts">
        @for (post of posts; track post.slug) {
          <li>
            <a class="posts__card" [routerLink]="['/blog', post.slug]">
              <span class="meta"
                >{{ post.published | date: 'd MMM y' }} · {{ post.readMinutes }} min read</span
              >
              <h2>{{ post.title }}</h2>
              <p>{{ post.description }}</p>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrls: ['../../../../shared/styles/content-page.scss', './blog-index.component.scss'],
})
export class BlogIndexComponent implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly posts = [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));

  ngOnInit(): void {
    const url = `${environment.appUrl}/blog`;
    this.seo.apply({
      title: 'Wedding Invitation Wording, Messages & Ideas — Blog',
      description:
        'Wedding invitation wording in Hindi & English, haldi and sangeet messages, WhatsApp etiquette and save the date ideas for Indian weddings.',
      url,
    });
    this.seo.setStructuredData([
      {
        '@type': 'Blog',
        '@id': `${url}#blog`,
        url,
        name: 'theinvitely.in Blog',
        inLanguage: 'en-IN',
        publisher: { '@id': `${environment.appUrl}/#organization` },
        blogPost: this.posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          url: `${url}/${post.slug}`,
          datePublished: post.published,
        })),
      },
      this.seo.breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
      ]),
    ]);
  }
}
