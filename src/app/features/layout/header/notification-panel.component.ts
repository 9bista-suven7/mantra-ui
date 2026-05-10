import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NotificationService,
  AppNotification,
} from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  protected readonly notifSvc = inject(NotificationService);

  trackById(_: number, n: AppNotification): string {
    return n.id;
  }

  onMarkRead(n: AppNotification, e: Event): void {
    e.stopPropagation();
    this.notifSvc.markRead(n.id);
  }

  onDismiss(n: AppNotification, e: Event): void {
    e.stopPropagation();
    this.notifSvc.dismiss(n.id);
  }

  /** Prevent clicks inside the panel from bubbling to the backdrop. */
  onPanelClick(e: Event): void {
    e.stopPropagation();
  }

  /** Close panel when user clicks outside (handled via backdrop overlay). */
  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.notifSvc.closePanel();
  }

  relativeTime(ts: number): string {
    const diffMs = Date.now() - ts;
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1)  return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  }
}
