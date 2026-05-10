import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthRequest, AuthResponse, RegisterRequest, User } from '../../models/user.model';
import { ApiResponse } from '../../models/bill.model';

/**
 * Manages authentication state — JWT storage, login, register, logout.
 * Uses signals so the current user is reactively available across components.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly TOKEN_KEY = 'mantra_token';
  private readonly USER_KEY = 'mantra_user';

  private readonly _currentUser = signal<AuthResponse | null>(this.loadUserFromStorage());
  readonly currentUser = this._currentUser.asReadonly();

  /**
   * Returns true only if a JWT exists AND is not yet expired.
   * Decodes the payload locally (no signature check needed on client).
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // exp is in seconds; Date.now() is in ms
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Logs in and stores the JWT + user info.
   */
  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    const body: AuthRequest = { email, password };
    return this.http.post<ApiResponse<AuthResponse>>('/api/auth/login', body).pipe(
      tap(res => this.persistSession(res.data))
    );
  }

  /**
   * Registers a new user and stores the JWT + user info.
   */
  register(req: RegisterRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>('/api/auth/register', req).pipe(
      tap(res => this.persistSession(res.data))
    );
  }

  /**
   * Returns the profile of the currently authenticated user from the API.
   */
  me(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>('/api/auth/me');
  }

  /**
   * Clears the session and navigates to the landing page.
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/']);
  }

  private persistSession(data: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data));
    this._currentUser.set(data);
  }

  private loadUserFromStorage(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
