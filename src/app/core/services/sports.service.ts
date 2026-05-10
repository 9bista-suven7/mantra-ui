import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** A single live or recent sports match score from the backend. */
export interface SportsScore {
  team1: string;
  abbr1: string;
  score1: number;
  team2: string;
  abbr2: string;
  score2: number;
  sport: string;
  league: string;
  /** Human-readable status: "Final", "Q3 2:45", "72'", "7:30 PM ET", etc. */
  status: string;
}

/** Fetches live sports scores via the backend proxy (GET /api/sports/scores). */
@Injectable({ providedIn: 'root' })
export class SportsService {
  private readonly http = inject(HttpClient);

  getScores(): Observable<SportsScore[]> {
    return this.http.get<SportsScore[]>('/api/sports/scores');
  }
}
