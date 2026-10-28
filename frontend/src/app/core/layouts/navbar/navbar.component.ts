import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { MagneticDirective } from '../../../shared/directives/magnetic.directive';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { ViewportService } from '../../services/viewport.service';
import { PRIMARY_NAV } from '../../constants/navigation.constants';
import { AuthService } from '../../services/auth.service';
import { ProfileMenuComponent } from '../../../shared/components/profile-menu/profile-menu.component';
import { APP_NAME } from '../../constants/app.constants';
import { filter } from 'rxjs';

/**
 * Fixed top navigation. Reacts to scroll (glass background) and viewport
 * width (desktop links vs. mobile menu) purely through ViewportService
 * signals — no local scroll/resize listeners.
 */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LogoComponent,
    ThemeToggleComponent,
    MagneticDirective,
    RouterLink,
    ProfileMenuComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  private readonly router = inject(Router);
  protected readonly viewport = inject(ViewportService);
  protected readonly auth = inject(AuthService);
  protected readonly navLinks = PRIMARY_NAV;
  protected readonly appName = APP_NAME;
  protected readonly mobileMenuOpen = signal(false);

  protected readonly currentUrl = signal<string>('/');
  protected readonly currentFragment = signal<string>('');

  protected isLinkActive = (link: { path?: string; fragment?: string }): boolean => {
    const url = this.currentUrl();
    const fragment = this.currentFragment();

    if (link.path) {
      return url === link.path;
    } else if (link.fragment) {
      return url === '/' && fragment === link.fragment;
    }
    return false;
  };

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || event.url;
        this.currentUrl.set(url.split('#')[0]);
        this.currentFragment.set(url.split('#')[1] || '');
      });

    const initialUrl = this.router.url;
    this.currentUrl.set(initialUrl.split('#')[0]);
    this.currentFragment.set(initialUrl.split('#')[1] || '');
  }

  protected signOut(): void {
    this.closeMobileMenu();
    this.auth.logout();
    void this.router.navigate(['/']);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
