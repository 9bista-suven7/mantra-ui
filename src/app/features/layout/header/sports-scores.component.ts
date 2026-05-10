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
import { SportsScore, SportsService } from '../../../core/services/sports.service';

const CYCLE_MS   = 8_000;        // 8 s per match
const REFRESH_MS = 5 * 60_000;   // re-fetch every 5 min (matches backend TTL)

@Component({
  selector: 'app-sports-scores',
  standalone: true,
  imports: [],
  templateUrl: './sports-scores.component.html',
  styleUrl: './sports-scores.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportsScoresComponent implements OnInit {
  private readonly sportsService = inject(SportsService);
  private readonly destroyRef    = inject(DestroyRef);

  readonly scores  = signal<SportsScore[]>([]);
  readonly index   = signal(0);
  readonly visible = signal(true);

  /** Currently displayed match — null when list is empty. */
  readonly current = computed<SportsScore | null>(() => {
    const list = this.scores();
    if (!list || list.length === 0) return null;
    return list[this.index()];
  });

  /**
   * True when the game appears to be in-progress
   * (status is neither "Final*" nor a future scheduled time).
   */
  readonly isLive = computed(() => {
    const s = (this.current()?.status ?? '').toLowerCase();
    return s.length > 0
        && !s.startsWith('final')
        && !s.includes('scheduled')
        && !s.includes(' pm')
        && !s.includes(' am')
        && !s.includes(':00 ');   // e.g. "7:30 ET"
  });

  /** Material Icon name for the current sport. */
  readonly sportIcon = computed(() => {
    switch ((this.current()?.sport ?? '').toLowerCase()) {
      case 'basketball': return 'sports_basketball';
      case 'football':   return 'sports_football';
      case 'hockey':     return 'sports_hockey';
      case 'baseball':   return 'sports_baseball';
      case 'cricket':    return 'sports_cricket';
      default:           return 'sports_soccer';
    }
  });

  ngOnInit(): void {
    this.loadScores();
    interval(CYCLE_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.advance());
    interval(REFRESH_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadScores());
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private loadScores(): void {
    this.sportsService.getScores().subscribe({
      next: (list) => {
        this.scores.set(list ?? []);
        this.index.set(0);
      },
      error: () => { /* silently ignore — strip stays hidden */ },
    });
  }

  private advance(): void {
    const len = this.scores().length;
    if (len === 0) return;
    this.visible.set(false);
    setTimeout(() => {
      this.index.update(i => (i + 1) % len);
      this.visible.set(true);
    }, 280);
  }
}
