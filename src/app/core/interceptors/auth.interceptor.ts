import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP interceptor — attaches JWT, sets Content-Type, and
 * delegates 401 handling to AuthService (which clears state and navigates
 * to the landing page). A module-level flag prevents multiple simultaneous
 * 401 responses (e.g. parallel API calls) from firing multiple logouts.
 */

let isHandling401 = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('mantra_token');
  const auth  = inject(AuthService);

  // Only modify requests going to our own API
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  let headers = req.headers;

  // Ensure JSON content type for requests with a body — but never for FormData,
  // which must keep the browser-generated multipart boundary intact.
  const isFormData = typeof FormData !== 'undefined' && req.body instanceof FormData;
  if (
    !isFormData &&
    !headers.has('Content-Type') &&
    (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
  ) {
    headers = headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  return next(req.clone({ headers })).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isHandling401) {
        isHandling401 = true;
        // AuthService.logout() clears storage, stops inactivity tracking, and navigates to '/'
        auth.logout();
        // Reset the flag after the navigation settles
        setTimeout(() => { isHandling401 = false; }, 2_000);
      }
      return throwError(() => err);
    })
  );
};
