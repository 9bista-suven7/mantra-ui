import {
  ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

// ── Open-Meteo weather code → display info ──────────────
const WEATHER_CODES: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: '☀️',  label: 'Clear sky'    },  1:  { emoji: '🌤️', label: 'Mainly clear' },
  2:  { emoji: '⛅',  label: 'Partly cloudy'},  3:  { emoji: '☁️',  label: 'Overcast'     },
  45: { emoji: '🌫️', label: 'Foggy'        },  48: { emoji: '🌫️', label: 'Icy fog'      },
  51: { emoji: '🌦️', label: 'Light drizzle'},  53: { emoji: '🌦️', label: 'Drizzle'      },
  55: { emoji: '🌧️', label: 'Heavy drizzle'},  61: { emoji: '🌧️', label: 'Light rain'   },
  63: { emoji: '🌧️', label: 'Rain'         },  65: { emoji: '🌧️', label: 'Heavy rain'   },
  71: { emoji: '🌨️', label: 'Light snow'   },  73: { emoji: '🌨️', label: 'Snow'         },
  75: { emoji: '❄️',  label: 'Heavy snow'   },  80: { emoji: '🌦️', label: 'Showers'      },
  82: { emoji: '🌧️', label: 'Heavy showers'},  85: { emoji: '🌨️', label: 'Snow showers' },
  95: { emoji: '⛈️',  label: 'Thunderstorm' },
};

// ── Curated daily quotes (rotates by day-of-year) ──────
const QUOTES = [
  { q: 'The secret of getting ahead is getting started.',                           a: 'Mark Twain'           },
  { q: "It always seems impossible until it's done.",                               a: 'Nelson Mandela'       },
  { q: "Whether you think you can or you can't, you're right.",                     a: 'Henry Ford'           },
  { q: 'The future belongs to those who believe in their dreams.',                  a: 'Eleanor Roosevelt'    },
  { q: "Don't count the days, make the days count.",                                a: 'Muhammad Ali'         },
  { q: "You miss 100% of the shots you don't take.",                                a: 'Wayne Gretzky'        },
  { q: 'The only way to do great work is to love what you do.',                     a: 'Steve Jobs'           },
  { q: 'Do one thing every day that scares you.',                                   a: 'Eleanor Roosevelt'    },
  { q: 'Dream big and dare to fail.',                                               a: 'Norman Vaughan'       },
  { q: 'The best time to plant a tree was 20 years ago. The second best is now.',  a: 'Chinese Proverb'      },
  { q: 'Either you run the day or the day runs you.',                               a: 'Jim Rohn'             },
  { q: 'The best revenge is massive success.',                                      a: 'Frank Sinatra'        },
  { q: 'Life is 10% what happens to you and 90% how you react to it.',             a: 'Charles R. Swindoll'  },
  { q: 'The mind is everything. What you think you become.',                        a: 'Buddha'               },
  { q: "I've learned that people will never forget how you made them feel.",        a: 'Maya Angelou'         },
  { q: "It's not whether you get knocked down, it's whether you get up.",           a: 'Vince Lombardi'       },
  { q: "I have not failed. I've just found 10,000 ways that won't work.",           a: 'Thomas Edison'        },
  { q: "You can't use up creativity. The more you use, the more you have.",         a: 'Maya Angelou'         },
  { q: 'Do what you can, with what you have, where you are.',                       a: 'Theodore Roosevelt'   },
  { q: "Build your own dreams, or someone else will hire you to build theirs.",     a: 'Farrah Gray'          },
  { q: 'Education is the most powerful weapon to change the world.',               a: 'Nelson Mandela'       },
  { q: 'You only live once, but if you do it right, once is enough.',               a: 'Mae West'             },
];

interface WeatherInfo {
  temp: number; emoji: string; label: string;
  windSpeed: number; humidity: number;
  city: string; country: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent implements OnInit, OnDestroy {

  private readonly http = inject(HttpClient);
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  // ── Clock ─────────────────────────────────────────────
  readonly currentTime = signal('');
  readonly currentDate = signal('');
  readonly timezone    = signal('');

  // ── Weather (open-meteo.com — free, no API key) ───────
  readonly weather        = signal<WeatherInfo | null>(null);
  readonly weatherLoading = signal(true);
  readonly weatherError   = signal(false);

  // ── Daily content ─────────────────────────────────────
  /** adviceslip.com — free, no API key */
  readonly advice  = signal<string | null>(null);
  /** uselessfacts.jsph.pl — free, no API key */
  readonly funFact = signal<string | null>(null);

  readonly features = [
    { icon: 'group',          label: 'Splitwise',  color: '#6C63FF', desc: 'Split bills fairly with smart settlement suggestions.', login: true  },
    { icon: 'forum',          label: 'Chat',       color: '#22d3ee', desc: 'Real-time DMs and group chats, with Splitwise built in.', login: true  },
    { icon: 'notifications',  label: 'Reminders',  color: '#00D9FF', desc: 'Priority alerts with recurrence — nothing slips.',         login: true  },
    { icon: 'sticky_note_2',  label: 'Notes',      color: '#FF6584', desc: 'Colour-coded masonry notes with tags and pinning.',       login: true  },
    { icon: 'receipt_long',   label: 'Bills',      color: '#4ECCA3', desc: 'Track every bill — know exactly what is due and when.',  login: true  },
    { icon: 'event',          label: 'Calendar',   color: '#f59e0b', desc: 'See your reminders and bills on a unified calendar.',     login: true  },
    { icon: 'transform',      label: 'Converter',  color: '#a855f7', desc: 'Word ↔ PDF, image ↔ PDF, merge, split, watermark, and more.', login: true },
    { icon: 'explore',        label: 'Discover',   color: '#ec4899', desc: 'Find new groups and conversations curated for you.',     login: true  },
  ];

  readonly year = new Date().getFullYear();

  /** Quote rotates by day-of-year — changes every midnight */
  get todaysQuote() {
    const start  = new Date(new Date().getFullYear(), 0, 0);
    const dayNum = Math.floor((Date.now() - start.getTime()) / 86_400_000);
    return QUOTES[dayNum % QUOTES.length];
  }

  ngOnInit(): void {
    this.startClock();
    this.loadWeather();
    this.loadAdvice();
    this.loadFunFact();
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  // ── Private helpers ────────────────────────────────────

  private startClock(): void {
    this.tick();
    this.clockInterval = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.currentDate.set(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    this.timezone.set(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  /**
   * Weather flow:
   * 1. ipapi.co  → city name + fallback lat/lon (free, no key)
   * 2. Browser geolocation → precise lat/lon (optional, improves accuracy)
   * 3. open-meteo.com → actual weather data (free, no key, OSS)
   */
  private loadWeather(): void {
    this.weatherLoading.set(true);

    this.http.get<any>('https://ipapi.co/json/').subscribe({
      next: ip => {
        const city    = ip.city         ?? 'Your area';
        const country = ip.country_name ?? '';
        // Use IP coords immediately
        this.fetchWeather(+ip.latitude, +ip.longitude, city, country);
        // Upgrade with precise geolocation if permitted
        navigator.geolocation?.getCurrentPosition(
          pos => this.fetchWeather(pos.coords.latitude, pos.coords.longitude, city, country),
          ()  => {} // IP coords already used — no-op
        );
      },
      error: () => {
        navigator.geolocation?.getCurrentPosition(
          pos => this.fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Your area', ''),
          ()  => { this.weatherLoading.set(false); this.weatherError.set(true); }
        );
      }
    });
  }

  private fetchWeather(lat: number, lon: number, city: string, country: string): void {
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh`;

    this.http.get<any>(url).subscribe({
      next: data => {
        const cur  = data.current;
        const info = WEATHER_CODES[cur.weather_code as number] ?? { emoji: '🌡️', label: 'Unknown' };
        this.weather.set({
          temp:      Math.round(cur.temperature_2m),
          emoji:     info.emoji,
          label:     info.label,
          windSpeed: Math.round(cur.wind_speed_10m),
          humidity:  Math.round(cur.relative_humidity_2m ?? 0),
          city, country
        });
        this.weatherLoading.set(false);
      },
      error: () => { this.weatherLoading.set(false); this.weatherError.set(true); }
    });
  }

  /** adviceslip.com — completely free, no API key required */
  private loadAdvice(): void {
    this.http.get<any>('https://api.adviceslip.com/advice').subscribe({
      next:  res => this.advice.set(res?.slip?.advice ?? null),
      error: ()  => {}
    });
  }

  /** uselessfacts.jsph.pl — completely free, no API key required */
  private loadFunFact(): void {
    this.http.get<any>('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en').subscribe({
      next:  res => this.funFact.set(res?.text ?? null),
      error: ()  => {}
    });
  }
}
