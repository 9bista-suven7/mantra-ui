import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProfileService } from '../../core/services/profile.service';

interface Zodiac {
  sign: string;
  emoji: string;
  dateRange: string;
  start: { m: number; d: number };
  end:   { m: number; d: number };
}

const ZODIACS: Zodiac[] = [
  { sign: 'capricorn',   emoji: '♑️', dateRange: 'Dec 22 – Jan 19', start: { m: 12, d: 22 }, end: { m: 1,  d: 19 } },
  { sign: 'aquarius',    emoji: '♒️', dateRange: 'Jan 20 – Feb 18', start: { m: 1,  d: 20 }, end: { m: 2,  d: 18 } },
  { sign: 'pisces',      emoji: '♓️', dateRange: 'Feb 19 – Mar 20', start: { m: 2,  d: 19 }, end: { m: 3,  d: 20 } },
  { sign: 'aries',       emoji: '♈️', dateRange: 'Mar 21 – Apr 19', start: { m: 3,  d: 21 }, end: { m: 4,  d: 19 } },
  { sign: 'taurus',      emoji: '♉️', dateRange: 'Apr 20 – May 20', start: { m: 4,  d: 20 }, end: { m: 5,  d: 20 } },
  { sign: 'gemini',      emoji: '♊️', dateRange: 'May 21 – Jun 20', start: { m: 5,  d: 21 }, end: { m: 6,  d: 20 } },
  { sign: 'cancer',      emoji: '♋️', dateRange: 'Jun 21 – Jul 22', start: { m: 6,  d: 21 }, end: { m: 7,  d: 22 } },
  { sign: 'leo',         emoji: '♌️', dateRange: 'Jul 23 – Aug 22', start: { m: 7,  d: 23 }, end: { m: 8,  d: 22 } },
  { sign: 'virgo',       emoji: '♍️', dateRange: 'Aug 23 – Sep 22', start: { m: 8,  d: 23 }, end: { m: 9,  d: 22 } },
  { sign: 'libra',       emoji: '♎️', dateRange: 'Sep 23 – Oct 22', start: { m: 9,  d: 23 }, end: { m: 10, d: 22 } },
  { sign: 'scorpio',     emoji: '♏️', dateRange: 'Oct 23 – Nov 21', start: { m: 10, d: 23 }, end: { m: 11, d: 21 } },
  { sign: 'sagittarius', emoji: '♐️', dateRange: 'Nov 22 – Dec 21', start: { m: 11, d: 22 }, end: { m: 12, d: 21 } },
];

interface ZodiacRow extends Zodiac {
  text: string | null;
  loading: boolean;
}

/**
 * Dedicated Horoscope page — shows horoscopes for all 12 zodiac signs.
 * The user's own zodiac (from their profile birth date) is highlighted.
 * If no birth date is set, a friendly message points to Settings.
 */
@Component({
  selector: 'app-horoscope',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './horoscope.component.html',
  styleUrl: './horoscope.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoroscopeComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  protected readonly profile = inject(ProfileService);

  /** Birth date sourced from the user's profile (no in-page input). */
  readonly birthDate = computed(() => this.profile.ext().dob || null);
  readonly today = signal(new Date());

  readonly myZodiac = computed<Zodiac | null>(() => {
    const bd = this.birthDate();
    if (!bd) return null;
    const d = new Date(bd);
    if (isNaN(d.getTime())) return null;
    return this.zodiacForDate(d);
  });

  readonly rows = signal<ZodiacRow[]>(
    ZODIACS.map(z => ({ ...z, text: null, loading: true }))
  );

  /** Currently selected zodiac for the detail card; defaults to the user's own. */
  readonly selectedSign = signal<string | null>(null);

  readonly selectedRow = computed<ZodiacRow | null>(() => {
    const sign = this.selectedSign();
    if (!sign) return null;
    return this.rows().find(r => r.sign === sign) ?? null;
  });

  ngOnInit(): void {
    const mine = this.myZodiac();
    if (mine) this.selectedSign.set(mine.sign);
    this.loadAll();
  }

  /** User clicked a zodiac card — show its full horoscope at the top. */
  selectSign(sign: string): void {
    this.selectedSign.set(sign);
    queueMicrotask(() => {
      document.getElementById('horo-detail')?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
    });
  }

  private loadAll(): void {
    ZODIACS.forEach((z, i) => {
      this.fetchHoroscope(z.sign).subscribe({
        next: text => {
          const next = [...this.rows()];
          next[i] = { ...next[i], text, loading: false };
          this.rows.set(next);
        },
        error: () => {
          const next = [...this.rows()];
          next[i] = { ...next[i], text: null, loading: false };
          this.rows.set(next);
        },
      });
    });
  }

  private fetchHoroscope(sign: string): Observable<string> {
    const url = `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=TODAY`;
    return new Observable<string>(sub => {
      this.http.get<{ data: { horoscope_data: string } }>(url).subscribe({
        next: res => { sub.next(res?.data?.horoscope_data ?? ''); sub.complete(); },
        error: err => sub.error(err),
      });
    });
  }

  private zodiacForDate(d: Date): Zodiac {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return ZODIACS.find(z => {
      if (z.start.m > z.end.m) {
        // Capricorn wraps year-end → year-start.
        return (m === z.start.m && day >= z.start.d) || (m === z.end.m && day <= z.end.d);
      }
      return (m === z.start.m && day >= z.start.d) || (m === z.end.m && day <= z.end.d) ||
             (m > z.start.m && m < z.end.m);
    }) ?? ZODIACS[0];
  }
}
