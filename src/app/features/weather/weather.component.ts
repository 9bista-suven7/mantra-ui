import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WEATHER_CODES, WeatherInfo } from '../dashboard/daily-data';

/**
 * Detailed weather page — shows current conditions and a 7-day forecast.
 * Uses Open-Meteo (no API key required) and ipapi.co for IP geolocation.
 */
@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeatherComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly weather  = signal<WeatherInfo | null>(null);
  readonly loading  = signal(true);
  readonly error    = signal(false);

  ngOnInit(): void {
    this.loadByIp();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.weather.set(null);
    this.loadByIp();
  }

  private loadByIp(): void {
    this.http.get<any>('https://ipapi.co/json/').subscribe({
      next: ip => {
        const city    = ip.city         ?? 'Your area';
        const country = ip.country_name ?? '';
        this.fetchWeather(+ip.latitude, +ip.longitude, city, country);
      },
      error: () => {
        navigator.geolocation?.getCurrentPosition(
          pos => this.fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Your area', ''),
          ()  => { this.loading.set(false); this.error.set(true); }
        );
      }
    });
  }

  private fetchWeather(lat: number, lon: number, city: string, country: string): void {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,pressure_msl`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset`
      + `&forecast_days=7&wind_speed_unit=kmh&timezone=auto`;
    this.http.get<any>(url).subscribe({
      next: data => {
        const cur  = data.current;
        const info = WEATHER_CODES[cur.weather_code as number] ?? { emoji: '🌡️', label: 'Unknown' };
        const d    = data.daily;
        const daily = d?.time?.map((date: string, i: number) => {
          const dInfo = WEATHER_CODES[d.weather_code[i] as number] ?? { emoji: '🌡️', label: '' };
          return {
            date,
            max: Math.round(d.temperature_2m_max[i]),
            min: Math.round(d.temperature_2m_min[i]),
            emoji: dInfo.emoji,
            label: dInfo.label,
            sunrise: d.sunrise?.[i],
            sunset:  d.sunset?.[i],
          };
        }) ?? [];
        this.weather.set({
          temp:      Math.round(cur.temperature_2m),
          emoji:     info.emoji,
          label:     info.label,
          windSpeed: Math.round(cur.wind_speed_10m),
          humidity:  Math.round(cur.relative_humidity_2m ?? 0),
          city, country,
          daily,
        });
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set(true); },
    });
  }

  forecastDayLabel(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  }

  formatTime(iso: string | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}
