import { Injectable, computed, signal } from '@angular/core';

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'github' | 'microsoft';
export type AuthErrorCode = 'invalid_credentials' | 'user_exists' | 'network_error' | 'invalid_otp' | 'expired_otp' | 'weak_password';
export interface AuthUser { readonly id: string; readonly email: string; readonly firstName?: string; readonly lastName?: string; readonly emailVerified: boolean; }
export interface AuthSession { readonly user: AuthUser; readonly token: string; readonly expiresAt?: number; }
export interface AuthResult { readonly ok: boolean; readonly error?: AuthErrorCode; readonly session?: AuthSession; }

/**
 * Minimal authentication state holder (signal-based). Wired for the future
 * auth/dashboard modules; the real token exchange lands with those features.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<AuthSession | null>(null);

  readonly session = this._session.asReadonly();
  readonly token = computed(() => this._session()?.token ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly loading = signal(false);

  setToken(token: string | null): void {
    this._session.set(token ? { token, user: { id: 'mock-user', email: 'user@example.com', emailVerified: true } } : null);
  }

  async login(email: string, _password: string, _remember = false): Promise<AuthResult> {
    this.loading.set(true);
    await this.delay();
    this.loading.set(false);
    const session: AuthSession = { token: `mock-${Date.now()}`, user: { id: 'mock-user', email: email.toLowerCase(), emailVerified: true } };
    this._session.set(session);
    return { ok: true, session };
  }

  async signup(firstName: string, lastName: string, email: string, _password: string): Promise<AuthResult> {
    this.loading.set(true);
    await this.delay();
    this.loading.set(false);
    return { ok: true, session: { token: `mock-${Date.now()}`, user: { id: 'mock-user', email, firstName, lastName, emailVerified: false } } };
  }

  async sendOtp(_email: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async verifyOtp(_otp: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async loginWithProvider(_provider: SocialProvider): Promise<AuthResult> { await this.delay(); return { ok: true }; }
  async resetPassword(_password: string): Promise<AuthResult> { await this.delay(); return { ok: true }; }

  logout(): void {
    this._session.set(null);
  }

  private delay(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 450)); }
}
