import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { WINDOW } from '../tokens/window.token';
import { THEME_STORAGE_KEY, type Theme } from '../models/theme.model';

/**
 * Owns the active colour theme. Presentation reads CSS custom properties
 * driven by the `data-theme` attribute this service maintains, so a toggle
 * costs one attribute write — no component re-render.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = inject(WINDOW);

  private readonly _theme = signal<Theme>(this.resolveInitialTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');
  /** Glyph shown on the toggle button (moon in dark, sun in light). */
  readonly icon = computed(() => (this.isDark() ? '☾' : '☀'));

  constructor() {
    // Reflect theme into the DOM + persist it, reactively.
    effect(() => {
      const theme = this._theme();
      this.document.documentElement.setAttribute('data-theme', theme);
      try {
        this.window?.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Storage may be unavailable (private mode / SSR) — non-fatal.
      }
    });
  }

  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  private resolveInitialTheme(): Theme {
    const stored = this.safeRead();
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    // Fall back to the OS preference, defaulting to the brand's dark theme.
    const prefersLight = this.window?.matchMedia?.('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }

  private safeRead(): string | null {
    try {
      return this.window?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
