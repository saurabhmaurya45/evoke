import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { AuthChangeEvent, AuthError, Provider, Session } from '@supabase/supabase-js';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupabaseClientService } from './supabase-client.service';

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'github' | 'microsoft';
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'user_exists'
  | 'network_error'
  | 'invalid_otp'
  | 'expired_otp'
  | 'weak_password'
  | 'unknown';
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

type PendingAction = 'confirm-signup' | 'password-reset' | 'otp';

/** Supabase's OAuth provider id for each button — Microsoft/Entra ID is "azure" in Supabase. */
const SUPABASE_PROVIDER: Record<SocialProvider, Provider> = {
  google: 'google',
  apple: 'apple',
  facebook: 'facebook',
  github: 'github',
  microsoft: 'azure',
};

interface CurrentUserResponse {
  data: {
    id: string;
    email: string;
    displayName: string | null;
    roles: string[];
    profileCompleted: boolean;
  };
}

/**
 * Authentication state holder backed by real Supabase Auth. Session persistence, token
 * refresh, and OAuth/email-link callback handling are owned by the Supabase client
 * (`SupabaseClientService`); this service projects that state into the app's own
 * `AuthUser` shape by cross-checking the backend's `/v1/auth/me`, which is the source
 * of truth for role and profile-completion (Supabase only knows identity, not roles).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseClientService).client;
  private readonly http = inject(HttpClient);

  private readonly _session = signal<AuthSession | null>(null);
  private readonly _ready = signal(false);
  private readonly _pendingEmail = signal<string | null>(null);
  private _pendingAction: PendingAction | null = null;

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this._session()?.user.role === 'admin');
  readonly loading = signal(false);

  /** Resolves once the initial session restore (and profile fetch) has settled. Awaited
   * by an app initializer so route guards never see a stale "logged out" state on refresh. */
  readonly ready = this._ready.asReadonly();

  /** Email awaiting OTP/confirmation/reset — read by the shared check-email/verify-otp screens. */
  readonly pendingEmail = this._pendingEmail.asReadonly();

  /** Initials for the navbar avatar, e.g. "Ananya Sharma" -> "AS". */
  readonly initials = computed(() => {
    const user = this._session()?.user;
    if (!user) return '';
    const fromName = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim();
    return (fromName || user.email[0] || '?').toUpperCase();
  });

  constructor() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      void this.handleAuthChange(event, session);
    });
  }

  async init(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    await this.handleAuthChange('INITIAL_SESSION', data.session);
    this._ready.set(true);
  }

  async login(email: string, password: string, _remember = false): Promise<AuthResult> {
    this.loading.set(true);
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    this.loading.set(false);
    if (error || !data.session) {
      return { ok: false, error: this.mapError(error) };
    }
    await this.handleAuthChange('SIGNED_IN', data.session);
    return { ok: true, session: this._session() ?? undefined };
  }

  async signup(firstName: string, lastName: string, email: string, password: string): Promise<AuthResult> {
    this.loading.set(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await this.supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${environment.appUrl}/email-verified`,
      },
    });
    this.loading.set(false);
    if (error) {
      return { ok: false, error: this.mapError(error) };
    }
    if (data.session) {
      await this.handleAuthChange('SIGNED_IN', data.session);
      // Best-effort: seed the profile fields already collected on the signup form.
      // Non-fatal if it fails — the user can complete their profile later.
      void this.patchProfile(data.session.access_token, { firstName, lastName });
      return { ok: true, session: this._session() ?? undefined };
    }
    // Email confirmation is required before a session exists.
    this._pendingEmail.set(normalizedEmail);
    this._pendingAction = 'confirm-signup';
    return { ok: true };
  }

  async sendOtp(email: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await this.supabase.auth.signInWithOtp({ email: normalizedEmail });
    if (error) {
      return { ok: false, error: this.mapError(error) };
    }
    this._pendingEmail.set(normalizedEmail);
    this._pendingAction = 'otp';
    return { ok: true };
  }

  async verifyOtp(otp: string): Promise<AuthResult> {
    const email = this._pendingEmail();
    if (!email) {
      return { ok: false, error: 'invalid_otp' };
    }
    const { data, error } = await this.supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error || !data.session) {
      return { ok: false, error: this.mapError(error, 'invalid_otp') };
    }
    await this.handleAuthChange('SIGNED_IN', data.session);
    this._pendingEmail.set(null);
    this._pendingAction = null;
    return { ok: true, session: this._session() ?? undefined };
  }

  /** Sends the "reset your password" email (a link, not a code) for the forgot-password flow. */
  async sendPasswordResetEmail(email: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await this.supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${environment.appUrl}/reset-password`,
    });
    if (error) {
      return { ok: false, error: this.mapError(error) };
    }
    this._pendingEmail.set(normalizedEmail);
    this._pendingAction = 'password-reset';
    return { ok: true };
  }

  /** Resends whichever email is currently pending (signup confirmation, OTP, or reset link). */
  async resendPending(): Promise<AuthResult> {
    const email = this._pendingEmail();
    if (!email || !this._pendingAction) {
      return { ok: false, error: 'unknown' };
    }
    switch (this._pendingAction) {
      case 'confirm-signup': {
        const { error } = await this.supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: `${environment.appUrl}/email-verified` },
        });
        return error ? { ok: false, error: this.mapError(error) } : { ok: true };
      }
      case 'password-reset':
        return this.sendPasswordResetEmail(email);
      case 'otp':
        return this.sendOtp(email);
    }
  }

  /** Sets a new password. Requires the temporary session established when the user
   * followed the password-reset email link (Supabase attaches it via the callback URL). */
  async resetPassword(password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.updateUser({ password });
    return error ? { ok: false, error: this.mapError(error) } : { ok: true };
  }

  /** Kicks off a full-page OAuth redirect. Only resolves if it fails to start (e.g. the
   * provider isn't enabled for this Supabase project) — success navigates away immediately. */
  async loginWithProvider(provider: SocialProvider): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: SUPABASE_PROVIDER[provider],
      options: { redirectTo: `${environment.appUrl}/auth/callback/${provider}` },
    });
    return error ? { ok: false, error: this.mapError(error) } : { ok: true };
  }

  logout(): void {
    // Capture token before clearing — the interceptor reads the signal, which
    // we're about to null out. Pass it manually so the header is always sent.
    const token = this._session()?.token;
    if (token) {
      this.http
        .post(`${environment.apiBaseUrl}/v1/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this._session.set(null);
    void this.supabase.auth.signOut();
  }

  private async handleAuthChange(
    _event: AuthChangeEvent | 'INITIAL_SESSION',
    session: Session | null,
  ): Promise<void> {
    if (!session) {
      this._session.set(null);
      return;
    }
    const profile = await this.fetchProfile(session);
    this._session.set({
      token: session.access_token,
      expiresAt: session.expires_at,
      user: profile ?? this.fallbackUser(session),
    });
  }

  /** The backend lazily provisions the app-side user row and returns the canonical
   * role/profile. Falls back to Supabase-only data (role: 'user') if it's unreachable,
   * so sign-in still works — with reduced privileges — during backend downtime. */
  private async fetchProfile(session: Session): Promise<AuthUser | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      );
      const metadata = session.user.user_metadata ?? {};
      return {
        id: response.data.id,
        email: response.data.email,
        firstName: (metadata['first_name'] as string | undefined) ?? undefined,
        lastName: (metadata['last_name'] as string | undefined) ?? undefined,
        emailVerified: !!session.user.email_confirmed_at,
        role: response.data.roles.includes('ADMIN') ? 'admin' : 'user',
      };
    } catch {
      return null;
    }
  }

  private fallbackUser(session: Session): AuthUser {
    const metadata = session.user.user_metadata ?? {};
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      firstName: (metadata['first_name'] as string | undefined) ?? undefined,
      lastName: (metadata['last_name'] as string | undefined) ?? undefined,
      emailVerified: !!session.user.email_confirmed_at,
      role: 'user',
    };
  }

  private async patchProfile(
    accessToken: string,
    profile: { firstName: string; lastName: string },
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(
          `${environment.apiBaseUrl}/v1/users/me`,
          { firstName: profile.firstName, lastName: profile.lastName },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
    } catch {
      // Non-fatal — the user can complete their profile later from account settings.
    }
  }

  private mapError(error: AuthError | null, fallback: AuthErrorCode = 'unknown'): AuthErrorCode {
    if (!error) return fallback;
    switch (error.code) {
      case 'invalid_credentials':
        return 'invalid_credentials';
      case 'user_already_exists':
        return 'user_exists';
      case 'weak_password':
        return 'weak_password';
      case 'otp_expired':
        return 'expired_otp';
      case 'otp_disabled':
        return 'invalid_otp';
      default:
        break;
    }
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('already registered') || message.includes('already exists')) return 'user_exists';
    if (message.includes('invalid login credentials')) return 'invalid_credentials';
    if (message.includes('password')) return 'weak_password';
    if (message.includes('expired')) return 'expired_otp';
    if (message.includes('token') || message.includes('otp') || message.includes('code')) return 'invalid_otp';
    if (!error.status || message.includes('fetch') || message.includes('network')) return 'network_error';
    return fallback;
  }
}
