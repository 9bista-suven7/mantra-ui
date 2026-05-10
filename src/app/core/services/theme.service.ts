import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'mantra_theme';

/**
 * Manages the global app theme (dark / light).
 * Applies a `light-mode` class to <html> and persists the preference.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly _theme = signal<Theme>(this.loadTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.applyTheme(this._theme());
  }

  /** Toggle between dark and light. */
  toggle(): void {
    const next: Theme = this._theme() === 'dark' ? 'light' : 'dark';
    this._theme.set(next);
    this.applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* quota */ }
  }

  private loadTheme(): Theme {
    try {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* ignore */ }
    return 'dark';
  }

  private applyTheme(theme: Theme): void {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }
}
