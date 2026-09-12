import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Single Supabase client for the app. Session persistence, auto token refresh, and
 * URL-based session detection (OAuth/email-link callbacks) are only meaningful in a
 * real browser tab — enabling them during SSR would try to touch `localStorage` (absent
 * on the server) and start refresh timers that outlive the request.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      auth: {
        persistSession: this.isBrowser,
        autoRefreshToken: this.isBrowser,
        detectSessionInUrl: this.isBrowser,
      },
    },
  );
}
