import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Avatar button + dropdown shown in place of the Log in / Start Creating
 * actions once a session exists. Closes on outside click, Escape, and after
 * any navigation from within the menu.
 */
@Component({
  selector: 'app-profile-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="pm">
      <button
        type="button"
        class="pm__avatar"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        [attr.aria-label]="'Account menu for ' + (auth.user()?.email ?? '')"
        (click)="open.set(!open())"
      >
        {{ auth.initials() }}
      </button>

      @if (open()) {
        <div class="pm__panel" role="menu">
          <div class="pm__id">
            <strong>{{ fullName() }}</strong>
            <small>{{ auth.user()?.email }}</small>
            @if (auth.isAdmin()) { <span class="pm__role">Admin</span> }
          </div>
          <a class="pm__item" routerLink="/dashboard" role="menuitem" (click)="close()">My dashboard</a>
          @if (auth.isAdmin()) {
            <a class="pm__item" routerLink="/admin" role="menuitem" (click)="close()">Admin dashboard</a>
          }
          <a class="pm__item" routerLink="/templates" role="menuitem" (click)="close()">Browse templates</a>
          <button class="pm__item pm__item--danger" type="button" role="menuitem" (click)="logout()">
            Sign out
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './profile-menu.component.scss',
})
export class ProfileMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly open = signal(false);

  protected fullName(): string {
    const user = this.auth.user();
    if (!user) return '';
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }

  protected close(): void {
    this.open.set(false);
  }

  protected logout(): void {
    this.close();
    this.auth.logout();
    void this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}
