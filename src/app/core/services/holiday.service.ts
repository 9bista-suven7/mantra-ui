import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

/** A holiday or festival entry. */
export interface Holiday {
  /** ISO date YYYY-MM-DD (Gregorian). */
  date: string;
  /** Localized display name. */
  name: string;
  /** Country code: 'US' | 'NP'. */
  country: 'US' | 'NP';
  /** True for federal/public holiday (typically gives a day off); false for cultural festival. */
  isPublic: boolean;
}

/** Curated Nepal festivals/public holidays for 2025-2027.
 *  Dates are Gregorian (AD). Lunar/festival dates were sourced from the
 *  official Nepal calendar; minor day-of variations may occur regionally. */
const NEPAL_HOLIDAYS: Holiday[] = [
  // 2025
  { date: '2025-01-11', name: 'Prithvi Jayanti', country: 'NP', isPublic: true },
  { date: '2025-01-15', name: 'Maghe Sankranti', country: 'NP', isPublic: true },
  { date: '2025-01-30', name: 'Sonam Lhosar', country: 'NP', isPublic: true },
  { date: '2025-02-19', name: 'Democracy Day', country: 'NP', isPublic: true },
  { date: '2025-02-26', name: 'Maha Shivaratri', country: 'NP', isPublic: true },
  { date: '2025-03-08', name: "International Women's Day", country: 'NP', isPublic: true },
  { date: '2025-03-13', name: 'Holi (Hill)', country: 'NP', isPublic: true },
  { date: '2025-03-14', name: 'Holi (Terai)', country: 'NP', isPublic: true },
  { date: '2025-03-30', name: 'Ghode Jatra', country: 'NP', isPublic: false },
  { date: '2025-04-06', name: 'Ram Navami', country: 'NP', isPublic: false },
  { date: '2025-04-13', name: 'Nepali New Year (Baisakh 1)', country: 'NP', isPublic: true },
  { date: '2025-05-01', name: 'Labour Day', country: 'NP', isPublic: true },
  { date: '2025-05-12', name: 'Buddha Jayanti', country: 'NP', isPublic: true },
  { date: '2025-05-29', name: 'Republic Day', country: 'NP', isPublic: true },
  { date: '2025-08-09', name: 'Janai Purnima / Raksha Bandhan', country: 'NP', isPublic: true },
  { date: '2025-08-10', name: 'Gai Jatra', country: 'NP', isPublic: false },
  { date: '2025-08-16', name: 'Krishna Janmashtami', country: 'NP', isPublic: true },
  { date: '2025-08-27', name: 'Teej', country: 'NP', isPublic: true },
  { date: '2025-09-19', name: 'Constitution Day', country: 'NP', isPublic: true },
  { date: '2025-09-29', name: 'Ghatasthapana', country: 'NP', isPublic: true },
  { date: '2025-10-01', name: 'Phulpati', country: 'NP', isPublic: true },
  { date: '2025-10-02', name: 'Maha Ashtami', country: 'NP', isPublic: true },
  { date: '2025-10-03', name: 'Maha Navami', country: 'NP', isPublic: true },
  { date: '2025-10-04', name: 'Vijaya Dashami (Dashain)', country: 'NP', isPublic: true },
  { date: '2025-10-20', name: 'Laxmi Puja (Tihar)', country: 'NP', isPublic: true },
  { date: '2025-10-22', name: 'Govardhan Puja / Mha Puja', country: 'NP', isPublic: true },
  { date: '2025-10-23', name: 'Bhai Tika', country: 'NP', isPublic: true },
  { date: '2025-10-28', name: 'Chhath Parva', country: 'NP', isPublic: true },
  { date: '2025-12-25', name: 'Christmas Day', country: 'NP', isPublic: true },
  { date: '2025-12-30', name: 'Tamu Lhosar', country: 'NP', isPublic: true },

  // 2026
  { date: '2026-01-11', name: 'Prithvi Jayanti', country: 'NP', isPublic: true },
  { date: '2026-01-15', name: 'Maghe Sankranti', country: 'NP', isPublic: true },
  { date: '2026-02-17', name: 'Sonam Lhosar', country: 'NP', isPublic: true },
  { date: '2026-02-15', name: 'Maha Shivaratri', country: 'NP', isPublic: true },
  { date: '2026-02-19', name: 'Democracy Day', country: 'NP', isPublic: true },
  { date: '2026-03-03', name: 'Holi (Hill)', country: 'NP', isPublic: true },
  { date: '2026-03-04', name: 'Holi (Terai)', country: 'NP', isPublic: true },
  { date: '2026-03-08', name: "International Women's Day", country: 'NP', isPublic: true },
  { date: '2026-03-26', name: 'Ram Navami', country: 'NP', isPublic: false },
  { date: '2026-04-14', name: 'Nepali New Year (Baisakh 1)', country: 'NP', isPublic: true },
  { date: '2026-05-01', name: 'Labour Day', country: 'NP', isPublic: true },
  { date: '2026-05-31', name: 'Buddha Jayanti', country: 'NP', isPublic: true },
  { date: '2026-05-29', name: 'Republic Day', country: 'NP', isPublic: true },
  { date: '2026-07-29', name: 'Janai Purnima / Raksha Bandhan', country: 'NP', isPublic: true },
  { date: '2026-08-04', name: 'Krishna Janmashtami', country: 'NP', isPublic: true },
  { date: '2026-08-15', name: 'Teej', country: 'NP', isPublic: true },
  { date: '2026-09-19', name: 'Constitution Day', country: 'NP', isPublic: true },
  { date: '2026-09-18', name: 'Ghatasthapana', country: 'NP', isPublic: true },
  { date: '2026-09-22', name: 'Maha Ashtami', country: 'NP', isPublic: true },
  { date: '2026-09-23', name: 'Maha Navami', country: 'NP', isPublic: true },
  { date: '2026-09-24', name: 'Vijaya Dashami (Dashain)', country: 'NP', isPublic: true },
  { date: '2026-11-08', name: 'Laxmi Puja (Tihar)', country: 'NP', isPublic: true },
  { date: '2026-11-10', name: 'Govardhan Puja / Mha Puja', country: 'NP', isPublic: true },
  { date: '2026-11-11', name: 'Bhai Tika', country: 'NP', isPublic: true },
  { date: '2026-11-16', name: 'Chhath Parva', country: 'NP', isPublic: true },
  { date: '2026-12-25', name: 'Christmas Day', country: 'NP', isPublic: true },

  // 2027 (key only)
  { date: '2027-01-11', name: 'Prithvi Jayanti', country: 'NP', isPublic: true },
  { date: '2027-01-15', name: 'Maghe Sankranti', country: 'NP', isPublic: true },
  { date: '2027-02-19', name: 'Democracy Day', country: 'NP', isPublic: true },
  { date: '2027-04-14', name: 'Nepali New Year (Baisakh 1)', country: 'NP', isPublic: true },
  { date: '2027-05-01', name: 'Labour Day', country: 'NP', isPublic: true },
  { date: '2027-05-29', name: 'Republic Day', country: 'NP', isPublic: true },
  { date: '2027-09-19', name: 'Constitution Day', country: 'NP', isPublic: true },
  { date: '2027-12-25', name: 'Christmas Day', country: 'NP', isPublic: true },
];

/**
 * Provides US federal holidays via the free Nager.Date API
 * (https://date.nager.at/Api) and curated Nepal holidays/festivals.
 * No API key required.
 */
@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<Holiday[]>>();

  /** Returns combined US + Nepal holidays for the given year. */
  getHolidays(year: number): Observable<Holiday[]> {
    const key = `combined-${year}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.fetchUS(year).pipe(
        map(us => [...us, ...NEPAL_HOLIDAYS.filter(h => h.date.startsWith(`${year}-`))]
          .sort((a, b) => a.date.localeCompare(b.date))),
        shareReplay(1)
      ));
    }
    return this.cache.get(key)!;
  }

  /** Holidays for the given year and country. */
  getByCountry(year: number, country: 'US' | 'NP'): Observable<Holiday[]> {
    return this.getHolidays(year).pipe(map(all => all.filter(h => h.country === country)));
  }

  private fetchUS(year: number): Observable<Holiday[]> {
    return this.http
      .get<Array<{ date: string; localName: string; name: string; types: string[] }>>(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/US`
      )
      .pipe(
        map(list => list.map(h => ({
          date: h.date,
          name: h.localName ?? h.name,
          country: 'US' as const,
          isPublic: h.types?.includes('Public') ?? true,
        }))),
        catchError(() => of([] as Holiday[]))
      );
  }
}
