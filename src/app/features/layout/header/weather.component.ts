import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, catchError, of } from 'rxjs';

const CYCLE_MS   = 5_000;        // 5 s per city
const REFRESH_MS = 10 * 60_000;  // re-fetch every 10 min

export interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  icon: string;
}

/** World capitals and major cities [name, latitude, longitude] */
const CITIES: [string, number, number][] = [
  ['Kathmandu',    27.7172,   85.3240],
  ['New York',     40.7128,  -74.0060],
  ['London',       51.5074,   -0.1278],
  ['Tokyo',        35.6762,  139.6503],
  ['Paris',        48.8566,    2.3522],
  ['Sydney',      -33.8688,  151.2093],
  ['Dubai',        25.2048,   55.2708],
  ['Mumbai',       19.0760,   72.8777],
  ['Beijing',      39.9042,  116.4074],
  ['Moscow',       55.7558,   37.6173],
  ['Singapore',     1.3521,  103.8198],
  ['Cairo',        30.0444,   31.2357],
  ['São Paulo',   -23.5505,  -46.6333],
  ['Nairobi',      -1.2921,   36.8219],
  ['Toronto',      43.6532,  -79.3832],
];

/** Maps WMO weather interpretation codes to a label and Material icon name. */
function wmoInfo(code: number): { label: string; icon: string } {
  if (code === 0)  return { label: 'Clear',         icon: 'wb_sunny'     };
  if (code <= 2)   return { label: 'Partly Cloudy', icon: 'cloud_queue'  };
  if (code === 3)  return { label: 'Overcast',      icon: 'cloud'        };
  if (code <= 48)  return { label: 'Foggy',         icon: 'foggy'        };
  if (code <= 57)  return { label: 'Drizzle',       icon: 'grain'        };
  if (code <= 67)  return { label: 'Rain',          icon: 'water_drop'   };
  if (code <= 77)  return { label: 'Snow',          icon: 'ac_unit'      };
  if (code <= 82)  return { label: 'Showers',       icon: 'water_drop'   };
  if (code <= 86)  return { label: 'Snow Showers',  icon: 'ac_unit'      };
  return           { label: 'Thunderstorm',         icon: 'thunderstorm' };
}

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeatherComponent implements OnInit {
  private readonly http       = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly cities  = signal<WeatherData[]>([]);
  readonly index   = signal(0);
  readonly visible = signal(true);

  /** Currently displayed city; null while loading. */
  readonly current = computed<WeatherData | null>(() => {
    const list = this.cities();
    if (!list.length) return null;
    return list[this.index()];
  });

  readonly tempStr = computed(() => {
    const c = this.current();
    return c ? `${Math.round(c.temp)}°F` : '';
  });

  ngOnInit(): void {
    this.load();

    interval(CYCLE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advance());

    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private advance(): void {
    const list = this.cities();
    if (!list.length) return;
    this.visible.set(false);
    setTimeout(() => {
      this.index.set((this.index() + 1) % list.length);
      this.visible.set(true);
    }, 280);
  }

  /**
   * Fetches all cities in a single Open-Meteo bulk request.
   * When multiple lat/lon pairs are passed, the API returns an array of results.
   */
  private load(): void {
    const lats = CITIES.map(c => c[1]).join(',');
    const lons = CITIES.map(c => c[2]).join(',');
    const url  =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lats}&longitude=${lons}` +
      `&current=temperature_2m,weather_code&timezone=auto&temperature_unit=fahrenheit`;

    this.http.get<any>(url).pipe(
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((resp) => {
      if (!resp) return;
      // When multiple locations are requested the response is an array
      const results: any[] = Array.isArray(resp) ? resp : [resp];
      const data: WeatherData[] = results.map((r, i) => {
        const { label, icon } = wmoInfo(r?.current?.weather_code ?? 0);
        return {
          city:      CITIES[i]?.[0] ?? 'Unknown',
          temp:      r?.current?.temperature_2m ?? 0,
          condition: label,
          icon,
        };
      });
      this.cities.set(data);
      if (this.index() >= data.length) this.index.set(0);
      this.visible.set(true);
    });
  }
}
