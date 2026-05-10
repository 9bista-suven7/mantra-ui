import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsTickerComponent } from './news-ticker.component';
import { SportsScoresComponent } from './sports-scores.component';
import { MarketIndicesComponent } from './market-indices.component';
import { WeatherComponent } from './weather.component';
import { NotificationPanelComponent } from './notification-panel.component';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NewsTickerComponent, SportsScoresComponent, MarketIndicesComponent, WeatherComponent, NotificationPanelComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme    = inject(ThemeService);
  protected readonly notifSvc = inject(NotificationService);
  protected readonly sidebar  = inject(SidebarService);
  private  readonly auth      = inject(AuthService);

  readonly currentTime = signal('');
  readonly currentDate = signal('');

  private clockTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.clockTimer) clearInterval(this.clockTimer);
    });

    // Start notification polling once the user is authenticated
    if (this.auth.isAuthenticated()) {
      this.notifSvc.init();
    }
  }

  private tick(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }));
    this.currentDate.set(now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }));
  }
}
