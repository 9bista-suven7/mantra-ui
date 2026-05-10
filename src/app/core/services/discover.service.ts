import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError } from 'rxjs/operators';

/** A single link/preview item in a Discover section. */
export interface DiscoverItem {
  label: string;
  hint?: string;
  url: string;
}

/** A grouping of related items inside a category. */
export interface DiscoverSection {
  title: string;
  icon: string;
  items: DiscoverItem[];
}

/** A top-level category surfaced as a tile in the dashboard's More Coming Soon grid. */
export interface DiscoverCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  tagline: string;
  sortOrder?: number;
  sections: DiscoverSection[];
}

/**
 * Fetches Discover-grid category data from the backend (sourced from MongoDB).
 * Result is cached in-memory for the session via {@code shareReplay}.
 */
@Injectable({ providedIn: 'root' })
export class DiscoverService {
  private readonly http = inject(HttpClient);
  private cache$?: Observable<DiscoverCategory[]>;

  /** Lists all discover categories. Cached after first successful call. */
  getCategories(): Observable<DiscoverCategory[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<DiscoverCategory[]>('/api/discover/categories')
        .pipe(
          catchError(() => of<DiscoverCategory[]>([])),
          shareReplay(1),
        );
    }
    return this.cache$;
  }
}
