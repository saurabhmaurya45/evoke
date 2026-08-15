import { Injectable, computed, inject, signal } from '@angular/core';
import { WINDOW } from '../tokens/window.token';

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'github' | 'microsoft';
export type AuthErrorCode = 'invalid_credentials' | 'user_exists' | 'network_error' | 'invalid_otp' | 'expired_otp' | 'weak_password';
export type UserRole = 'user' | 'admin';
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly emailVerified: boolean;
  readonly role: UserRole;
}
export interface AuthSession { readonly user: AuthUser; readonly token: string; readonly expiresAt?: number; }
export interface AuthResult { readonly ok: boolean; readonly error?: AuthErrorCode; readonly session?: AuthSession; }

/**
 * Demo credentials. Stand-ins until the real token exchange lands — each maps
 * to a seeded account in DashboardContentService so the signed-in flow shows
 * realistic data. Swap this table for an API call and nothing downstream
 * changes: the session shape is already what a real backend would return.
 */
const DEMO_ACCOUNTS: readonly (AuthUser & { readonly password: string })[] = [
  {
    id: 'usr-ananya',
    email: 'user@evoke.test',
    password: 'evoke123',
    firstName: 'Ananya',
    lastName: 'Sharma',
    emailVerified: true,
    role: 'user',
  },
  {
    id: 'usr-admin',
    email: 'admin@evoke.test',
    password: 'admin123',
    firstName: 'Evoke',
    lastName: 'Admin',
    emailVerified: true,
    role: 'admin',
  },
];

/** Shown on the login screen so the demo flow is walkable without a backend. */
export const DEMO_CREDENTIALS = DEMO_ACCOUNTS.map((account) => ({
  email: account.email,
  password: account.password,
  role: account.role,
}));

/**
 * Minimal authentication state holder (signal-based). Wired for the future
 * auth/dashboard modules; the real token exchange lands with those features.
 */
/** sessionStorage key holding the active session (cleared when the tab closes). */
const SESSION_KEY = 'evoke:session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly window = inject(WINDOW);

  /**
   * Seeded from sessionStorage so a full page load (or a link that leaves the
   * SPA) keeps the user signed in for the life of the tab. Every write goes
   * through `setSession`, so storage never drifts from the signal.
   */
  private readonly _session = signal<AuthSession | null>(this.restore());

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this._session()?.user.role === 'admin');
  readonly loading = signal(false);

  /** Initials for the navbar avatar, e.g. "Ananya Sharma" -> "AS". */
  readonly initials = computed(() => {
    const user = this._session()?.user;
    if (!user) return '';
    const fromName = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim();
    return (fromName || user.email[0] || '?').toUpperCase();
  });

  setToken(token: string | null): void {
    this.setSession(
      token
        ? { token, user: { id: 'mock-user', email: 'user@example.com', emailVerified: true, role: 'user' } }
        : null,
    );
  }

  async login(email: string, password: string, _remember = false): Promise<AuthResult> {
    this.loading.set(true);
    await this.delay();
    const match = DEMO_ACCOUNTS.find(
      (account) => account.email === email.trim().toLowerCase() && account.password === password,
    );
    this.loading.set(false);
    if (!match) {
      return { ok: false, error: 'invalid_credentials' };
    }
    const { password: _omit, ...user } = match;
    const session: AuthSession = { token: `mock-${Date.now()}`, user };
    this.setSession(session);
    return { ok: true, session };
  }

  async signup(firstName: string, lastName: string, email: string, _password: string): Promise<AuthResult> {
    this.loading.set(true);
    await this.delay();
    this.loading.set(false);
    return {
      ok: true,
      session: {
        token: `mock-${Date.now()}`,
        user: { id: 'mock-user', email, firstName, lastName, emailVerified: false, role: 'user' },
      },
    };
  }

  async sendOtp(_email: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async verifyOtp(_otp: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async loginWithProvider(_provider: SocialProvider): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async resetPassword(_password: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }

  logout(): void {
    this.setSession(null);
  }

  /** Single write path: keeps the signal and sessionStorage in lockstep. */
  private setSession(session: AuthSession | null): void {
    this._session.set(session);
    try {
      if (session) {
        this.window?.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        this.window?.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Storage unavailable (private mode / quota) — the in-memory signal still
      // works for this page load; only cross-reload persistence is lost.
    }
  }

  /** Read a previously stored session, discarding anything malformed. */
  private restore(): AuthSession | null {
    try {
      const raw = this.window?.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      return parsed?.token && parsed.user?.id && parsed.user.role ? parsed : null;
    } catch {
      return null;
    }
  }

  private delay(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 450)); }
}
