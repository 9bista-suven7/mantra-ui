import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** A single news headline returned by the backend. */
export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  category: 'general' | 'sports' | string;
}

/** Fetches top news headlines via the backend proxy (keeps API key server-side). */
@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);

  getHeadlines(): Observable<NewsHeadline[]> {
    return this.http.get<NewsHeadline[]>('/api/news/headlines');
  }
}
