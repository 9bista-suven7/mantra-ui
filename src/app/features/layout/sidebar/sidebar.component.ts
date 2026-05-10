import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, inject, OnInit, signal, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { filter } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit {

  protected readonly auth    = inject(AuthService);
  protected readonly profile = inject(ProfileService);
  protected readonly sidebarSvc = inject(SidebarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  @ViewChild('avatarFileInput') private avatarFileInput!: ElementRef<HTMLInputElement>;

  readonly currentTime     = signal('');
  readonly showProfileCard = signal(false);
  /** Cycling brand-icon color (changes every 10s). */
  readonly brandIconColor  = signal('#C0392B');

  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private colorTimer: ReturnType<typeof setInterval> | null = null;

  /** Theme-matching palette including vintage red/green/blue. */
  private readonly brandColors: string[] = [
    '#C0392B', // vintage red
    '#4F8A5B', // vintage green
    '#3B5F8A', // vintage blue
    '#6C63FF', // primary indigo
    '#9333EA', // secondary purple
    '#00D9FF', // cyan accent
    '#FF6584', // pink accent
    '#FFB347', // warm amber
    '#4ECCA3', // teal mint
    '#E0B872', // vintage gold
    '#A855F7', // violet
    '#FF6B6B', // coral
  ];
  private colorIdx = 0;

  /** Close profile card when user clicks anywhere outside the pill-wrap. */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.showProfileCard.set(false);
  }

  toggleProfileCard(event: MouseEvent): void {
    event.stopPropagation();
    this.showProfileCard.update(v => !v);
  }

  triggerAvatarUpload(event: MouseEvent): void {
    event.stopPropagation();
    this.avatarFileInput.nativeElement.click();
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.profile.setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    input.value = ''; // allow re-selecting the same file
  }

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 60_000);
    this.cycleColor();
    this.colorTimer = setInterval(() => this.cycleColor(), 10_000);

    // Close sidebar drawer on mobile when navigating to a new route
    const sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => this.sidebarSvc.close());

    this.destroyRef.onDestroy(() => {
      if (this.clockTimer) clearInterval(this.clockTimer);
      if (this.colorTimer) clearInterval(this.colorTimer);
      sub.unsubscribe();
    });
  }

  private cycleColor(): void {
    this.brandIconColor.set(this.brandColors[this.colorIdx % this.brandColors.length]);
    this.colorIdx++;
  }

  private tick(): void {
    this.currentTime.set(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }));
  }

  readonly navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',        route: '/app/dashboard' },
    { label: 'Chat',       icon: 'chat',              route: '/app/chat' },
    { label: 'Market',     icon: 'show_chart',        route: '/app/market' },
    { label: 'Splitwise',  icon: 'group',             route: '/app/splitwise' },
    { label: 'Calendar',   icon: 'calendar_month',    route: '/app/calendar' },
    { label: 'Todo',       icon: 'checklist',         route: '/app/todo' },
    { label: 'Notes',      icon: 'sticky_note_2',     route: '/app/notes' },
    { label: 'Bills',      icon: 'receipt_long',      route: '/app/bills' },
    { label: 'Converter',  icon: 'transform',          route: '/app/converter' },
    { label: 'Settings',   icon: 'settings',            route: '/app/settings'  },
  ];

  logout(): void {
    this.auth.logout();
  }
}
