import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { MagneticDirective } from '../../../shared/directives/magnetic.directive';
import { RouterLink } from '@angular/router';
import { ViewportService } from '../../services/viewport.service';
import { PRIMARY_NAV } from '../../constants/navigation.constants';

/**
 * Fixed top navigation. Reacts to scroll (glass background) and viewport
 * width (desktop links vs. mobile menu) purely through ViewportService
 * signals — no local scroll/resize listeners.
 */
@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoComponent, ThemeToggleComponent, MagneticDirective, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly viewport = inject(ViewportService);
  protected readonly navLinks = PRIMARY_NAV;
  protected readonly mobileMenuOpen = signal(false);

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected href(fragment?: string): string {
    return fragment ? `#${fragment}` : '#';
  }
}
