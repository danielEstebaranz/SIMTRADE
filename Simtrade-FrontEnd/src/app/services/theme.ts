import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'simtrade_theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeState = signal<AppTheme>(this.readStoredTheme());

  readonly theme = this.themeState.asReadonly();

  constructor() {
    effect(() => this.applyTheme(this.themeState()));
  }

  setTheme(theme: AppTheme): void {
    this.themeState.set(theme);
  }

  private applyTheme(theme: AppTheme): void {
    if (!this.isBrowser()) {
      return;
    }

    const root = this.document.documentElement;
    root.dataset['theme'] = theme;
    root.style.colorScheme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  private readStoredTheme(): AppTheme {
    if (!this.isBrowser()) {
      return 'light';
    }

    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
