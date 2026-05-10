import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MarketService, StockIndex } from '../../../core/services/market.service';

const CYCLE_MS   = 5_000;       // 5 s per index
const REFRESH_MS = 5 * 60_000;  // re-fetch every 5 min (matches backend cache TTL)

/**
 * Displays a cycling strip of live stock-market index quotes
 * (NYSE, NASDAQ, S&P 500, SENSEX, NEPSE, etc.) in the app header.
 */
@Component({
  selector: 'app-market-indices',
  standalone: true,
  imports: [],
  templateUrl: './market-indices.component.html',
  styleUrl: './market-indices.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketIndicesComponent implements OnInit {
  private readonly marketService = inject(MarketService);
  private readonly destroyRef    = inject(DestroyRef);

  readonly indices = signal<StockIndex[]>([]);
  readonly index   = signal(0);
  readonly visible = signal(true);

  /** Currently displayed index quote — null when list is empty. */
  readonly current = computed<StockIndex | null>(() => {
    const list = this.indices();
    if (!list || list.length === 0) return null;
    return list[this.index()];
  });

  /** True when the change is positive (or zero). */
  readonly isUp = computed(() => (this.current()?.change ?? 0) >= 0);

  /** Formatted price string (comma-separated thousands). */
  readonly priceStr = computed(() => {
    const p = this.current()?.price;
    if (p == null) return '';
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  /** Formatted change-percent string with sign. */
  readonly changePctStr = computed(() => {
    const c = this.current()?.changePercent;
    if (c == null) return '';
    const sign = c >= 0 ? '+' : '';
    return `${sign}${c.toFixed(2)}%`;
  });

  ngOnInit(): void {
    this.loadIndices();

    interval(CYCLE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advance());

    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadIndices());
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private loadIndices(): void {
    this.marketService.getStockIndices().subscribe({
      next: (list) => {
        this.indices.set(list ?? []);
        this.index.set(0);
        this.visible.set(true);
      },
      error: () => { /* silently ignore — strip stays empty */ },
    });
  }

  private advance(): void {
    const len = this.indices().length;
    if (len === 0) return;

    this.visible.set(false);
    setTimeout(() => {
      this.index.update(i => (i + 1) % len);
      this.visible.set(true);
    }, 280);
  }
}
