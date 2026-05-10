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
import { NewsHeadline, NewsService } from '../../../core/services/news.service';

const CYCLE_INTERVAL_MS = 10_000; // 10 seconds per headline
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes — matches backend cache TTL

@Component({
  selector: 'app-news-ticker',
  standalone: true,
  imports: [],
  templateUrl: './news-ticker.component.html',
  styleUrl: './news-ticker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsTickerComponent implements OnInit {
  private readonly newsService = inject(NewsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly headlines = signal<NewsHeadline[]>([]);
  readonly index = signal(0);
  readonly visible = signal(true);

  readonly current = computed<NewsHeadline | null>(() => {
    const list = this.headlines();
    if (!list || list.length === 0) return null;
    return list[this.index()];
  });

  readonly badge = computed(() => {
    const cat = this.current()?.category;
    if (cat === 'sports')        return { icon: 'sports_soccer', label: 'SPORTS', cls: 'sports-label' };
    if (cat === 'international') return { icon: 'language',      label: 'WORLD',  cls: 'intl-label' };
    return                              { icon: 'newspaper',     label: 'LIVE',   cls: '' };
  });

  ngOnInit(): void {
    this.loadHeadlines();

    // Cycle through headlines every 10 seconds
    interval(CYCLE_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advance());

    // Refresh from backend every 15 minutes
    interval(REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadHeadlines());
  }

  openArticle(): void {
    const item = this.current();
    if (item?.url) window.open(item.url, '_blank', 'noopener,noreferrer');
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private loadHeadlines(): void {
    this.newsService.getHeadlines().subscribe({
      next: (list) => {
        this.headlines.set(list ?? []);
        this.index.set(0);
      },
      error: () => { /* silently ignore — ticker simply stays empty */ },
    });
  }

  private advance(): void {
    const len = this.headlines().length;
    if (len === 0) return;

    // Fade out
    this.visible.set(false);

    // After fade-out (300ms) advance index and fade back in
    setTimeout(() => {
      this.index.update(i => (i + 1) % len);
      this.visible.set(true);
    }, 300);
  }
}
