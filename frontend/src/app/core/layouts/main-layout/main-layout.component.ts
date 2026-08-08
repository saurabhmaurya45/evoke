import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { SceneBackdropComponent } from '../scene-backdrop/scene-backdrop.component';

/**
 * Application shell: a global Three.js backdrop, navigation and footer
 * wrapping the routed view. The backdrop sits at z-index 0; content layers
 * (shell, footer, nav) stack above it, and sections stay transparent so the
 * 3D layer shows through the whole page.
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, SceneBackdropComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>
    @defer (on idle) {
      <app-scene-backdrop />
    }
    @if (!isAuthRoute()) { <app-navbar /> }
    <main id="main-content" class="shell">
      <router-outlet />
    </main>
    @if (!isAuthRoute()) { <app-footer /> }
  `,
  styles: [
    `
      .shell {
        position: relative;
        z-index: 1;
        display: block;
        min-height: 60vh;
        overflow-x: hidden;
      }
    `,
  ],
})
export class MainLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isAuthRoute = signal(this.router.url.startsWith('/login') || this.router.url.startsWith('/signup') || this.router.url.startsWith('/verify-otp') || this.router.url.startsWith('/forgot-password') || this.router.url.startsWith('/reset-password') || this.router.url.startsWith('/check-email') || this.router.url.startsWith('/email-verified') || this.router.url.startsWith('/auth/'));

  constructor() {
    const subscription = this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => this.isAuthRoute.set(event.urlAfterRedirects.startsWith('/login') || event.urlAfterRedirects.startsWith('/signup') || event.urlAfterRedirects.startsWith('/verify-otp') || event.urlAfterRedirects.startsWith('/forgot-password') || event.urlAfterRedirects.startsWith('/reset-password') || event.urlAfterRedirects.startsWith('/check-email') || event.urlAfterRedirects.startsWith('/email-verified') || event.urlAfterRedirects.startsWith('/auth/')));
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
