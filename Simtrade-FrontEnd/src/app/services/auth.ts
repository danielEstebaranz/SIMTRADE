import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { catchError, map, Observable, throwError, tap } from 'rxjs';
import { AppTheme, ThemeService } from './theme';

export interface UserSettings {
  theme: AppTheme;
}

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  saldo: number;
  cartera: Record<string, number>;
  settings?: UserSettings;
}

interface AuthResponse {
  message: string;
  user: AuthUser;
  idToken?: string;
  refreshToken?: string;
}

interface AuthPayload {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);
  private readonly apiUrl = 'http://127.0.0.1:8000';
  private readonly userState = signal<AuthUser | null>(this.readStoredUser());
  private readonly tokenState = signal<string | null>(this.readStoredToken());

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null && this.tokenState() !== null);
  readonly idToken = this.tokenState.asReadonly();

  constructor() {
    const storedTheme = this.userState()?.settings?.theme;

    if (storedTheme) {
      this.themeService.setTheme(storedTheme);
    }
  }

  login(payload: AuthPayload): Observable<AuthUser> {
    return this.sendAuthRequest('/auth/login', payload);
  }

  register(payload: AuthPayload): Observable<AuthUser> {
    return this.sendAuthRequest('/auth/register', payload);
  }

  refreshCurrentUser(): Observable<AuthUser> {
    const token = this.tokenState();

    if (!token) {
      return throwError(() => 'No hay sesion activa.');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.get<AuthResponse>(`${this.apiUrl}/auth/me`, { headers }).pipe(
      tap((response) => this.updateUser(response.user)),
      map((response) => response.user),
      catchError((error: HttpErrorResponse) => throwError(() => this.getErrorMessage(error))),
    );
  }

  logout(): void {
    this.userState.set(null);
    this.tokenState.set(null);

    if (this.isBrowser()) {
      localStorage.removeItem('simtrade_user');
      localStorage.removeItem('simtrade_token');
    }
  }

  updateUser(user: AuthUser): void {
    this.userState.set(user);
    this.syncUserTheme(user);

    if (this.isBrowser()) {
      localStorage.setItem('simtrade_user', JSON.stringify(user));
    }
  }

  private sendAuthRequest(path: string, payload: AuthPayload): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${this.apiUrl}${path}`, payload).pipe(
      tap((response) => this.storeSession(response.user, response.idToken)),
      map((response) => response.user),
      catchError((error: HttpErrorResponse) => throwError(() => this.getErrorMessage(error))),
    );
  }

  private storeSession(user: AuthUser, token?: string): void {
    this.userState.set(user);
    this.tokenState.set(token ?? null);
    this.syncUserTheme(user);

    if (this.isBrowser()) {
      localStorage.setItem('simtrade_user', JSON.stringify(user));
      if (token) {
        localStorage.setItem('simtrade_token', token);
      } else {
        localStorage.removeItem('simtrade_token');
      }
    }
  }

  private readStoredUser(): AuthUser | null {
    if (!this.isBrowser()) {
      return null;
    }

    const storedUser = localStorage.getItem('simtrade_user');

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      localStorage.removeItem('simtrade_user');
      return null;
    }
  }

  private readStoredToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem('simtrade_token');
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private syncUserTheme(user: AuthUser): void {
    const theme = user.settings?.theme;

    if (theme) {
      this.themeService.setTheme(theme);
    }
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    if (typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    if (error.status === 0) {
      return 'No se puede conectar con el backend. Arranca la API en el puerto 8000.';
    }

    return 'No se pudo completar la operacion.';
  }
}
