import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { CurrencyRate, MarketData, MarketService } from '../../core/services/market.service';

/** Currency codes that are visible by default */
const DEFAULT_CURRENCIES = new Set(['INR', 'NPR', 'EUR']);

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market.component.html',
  styleUrl: './market.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketComponent implements OnInit {
  private readonly marketSvc = inject(MarketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<MarketData | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  /** Set of currency codes the user has enabled */
  readonly activeCurrencies = signal<Set<string>>(new Set(DEFAULT_CURRENCIES));

  /** Currencies filtered to only active ones */
  readonly visibleCurrencies = computed<CurrencyRate[]>(() => {
    const d = this.data();
    if (!d) return [];
    const active = this.activeCurrencies();
    return d.currencies.filter(c => active.has(c.code));
  });

  ngOnInit(): void {
    interval(10_000)
      .pipe(
        startWith(0),
        switchMap(() => this.marketSvc.getMarketData()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (d) => { this.data.set(d); this.loading.set(false); this.error.set(false); },
        error: () => { this.loading.set(false); this.error.set(true); },
      });
  }

  toggleCurrency(code: string): void {
    this.activeCurrencies.update(set => {
      const next = new Set(set);
      if (next.has(code)) { next.delete(code); } else { next.add(code); }
      return next;
    });
  }

  isCurrencyActive(code: string): boolean {
    return this.activeCurrencies().has(code);
  }

  formatUsd(n: number): string {
    if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1)    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }

  formatNpr(n: number): string {
    return '₨' + Math.round(n).toLocaleString('en-US');
  }

  formatRate(rate: number, code: string): string {
    const sym = CURRENCY_SYMBOLS[code] ?? code + ' ';
    if (rate >= 1) return sym + rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return sym + rate.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }

  changeClass(change: number): string { return change >= 0 ? 'up' : 'down'; }
  changeSign(change: number): string  { return change >= 0 ? '+' : ''; }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', NPR: '₨', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr ', SGD: 'S$', AED: 'د.إ ', KRW: '₩',
};
