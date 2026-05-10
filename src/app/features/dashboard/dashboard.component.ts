import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit,
  inject, signal, viewChild, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ReminderService } from '../../core/services/reminder.service';
import { NoteService } from '../../core/services/note.service';
import { BillService } from '../../core/services/bill.service';
import { ExpenseService } from '../../core/services/expense.service';
import { DiscoverService, DiscoverCategory } from '../../core/services/discover.service';
import { Reminder, Priority } from '../../models/reminder.model';

interface StatCard {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {

  protected readonly auth = inject(AuthService);
  private readonly reminderSvc = inject(ReminderService);
  private readonly noteSvc = inject(NoteService);
  private readonly billSvc = inject(BillService);
  private readonly expenseSvc = inject(ExpenseService);
  private readonly discoverSvc = inject(DiscoverService);
  private readonly http = inject(HttpClient);

  // ── Currency converter (Daily Brief widget) ─ frankfurter.app, free ─
  readonly fxCurrencies = ['USD','EUR','GBP','INR','NPR','JPY','CAD','AUD','CHF','CNY','SGD'];
  readonly fxFrom    = signal<string>('USD');
  readonly fxTo      = signal<string>('EUR');
  readonly fxAmount  = signal<number>(100);
  readonly fxRate    = signal<number | null>(null);
  readonly fxResult  = signal<number | null>(null);
  readonly fxLoading = signal<boolean>(false);
  readonly fxError   = signal<boolean>(false);

  // Open state for custom (non-native) dropdowns to eliminate Windows white-flash
  readonly fxFromOpen = signal<boolean>(false);
  readonly fxToOpen   = signal<boolean>(false);

  toggleFxFrom(): void { this.fxToOpen.set(false); this.fxFromOpen.update(v => !v); }
  toggleFxTo():   void { this.fxFromOpen.set(false); this.fxToOpen.update(v => !v); }
  closeFxMenus(): void { this.fxFromOpen.set(false); this.fxToOpen.set(false); }
  pickFxFrom(c: string): void { this.fxFrom.set(c); this.fxFromOpen.set(false); this.convertCurrency(); }
  pickFxTo(c: string):   void { this.fxTo.set(c);   this.fxToOpen.set(false);   this.convertCurrency(); }

  readonly loading = signal(true);
  readonly stats = signal<StatCard[]>([
    { label: 'Upcoming Reminders', value: 0, icon: 'notifications',   color: '#6C63FF', route: '/app/reminders' },
    { label: 'Active Notes',       value: 0, icon: 'sticky_note_2',   color: '#00D9FF', route: '/app/notes' },
    { label: 'Unpaid Bills',       value: 0, icon: 'receipt_long',    color: '#FF6584', route: '/app/bills' },
    { label: 'Expense Groups',     value: 0, icon: 'group',            color: '#4ECCA3', route: '/app/splitwise' },
  ]);

  readonly greetingMessage = signal('');

  ngOnInit(): void {
    this.greetingMessage.set(this.buildGreeting());

    forkJoin({
      reminders: this.reminderSvc.getUpcoming(),
      notes: this.noteSvc.getAll(),
      bills: this.billSvc.getByStatus('UNPAID'),
      groups: this.expenseSvc.getGroups()
    }).subscribe({
      next: (data) => {
        this.stats.set([
          { label: 'Upcoming Reminders', value: data.reminders.length, icon: 'notifications',  color: '#6C63FF', route: '/app/reminders' },
          { label: 'Active Notes',       value: data.notes.length,     icon: 'sticky_note_2',  color: '#00D9FF', route: '/app/notes' },
          { label: 'Unpaid Bills',       value: data.bills.length,     icon: 'receipt_long',   color: '#FF6584', route: '/app/bills' },
          { label: 'Expense Groups',     value: data.groups.length,    icon: 'group',           color: '#4ECCA3', route: '/app/splitwise' },
        ]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.loadUpcomingReminders();
    this.loadDiscover();
    this.convertCurrency();
  }

  // ── Upcoming reminders panel (mirrors calendar style) ───────────────
  readonly upcomingReminders = signal<Reminder[]>([]);
  readonly priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'LOW',    label: 'Low',    color: '#4ECCA3' },
    { value: 'MEDIUM', label: 'Medium', color: '#FFB347' },
    { value: 'HIGH',   label: 'High',   color: '#FF6584' },
    { value: 'URGENT', label: 'Urgent', color: '#FF4444' },
  ];
  private loadUpcomingReminders(): void {
    this.reminderSvc.getUpcoming().subscribe({
      next: list => this.upcomingReminders.set((list ?? []).slice(0, 5)),
      error: () => { /* non-fatal */ },
    });
  }
  isOverdue(r: Reminder): boolean {
    return r.status === 'PENDING' && new Date(r.reminderTime) < new Date();
  }
  priorityConfig(p: Priority) {
    return this.priorities.find(x => x.value === p) ?? this.priorities[1];
  }
  completeReminder(id: string): void {
    this.reminderSvc.complete(id).subscribe(() => this.loadUpcomingReminders());
  }
  deleteReminder(id: string): void {
    this.reminderSvc.delete(id).subscribe(() => this.loadUpcomingReminders());
  }

  private buildGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  readonly quickActions = [
    { label: 'Add Reminder', icon: 'add_alert',    route: '/app/reminders', color: '#6C63FF' },
    { label: 'New Note',     icon: 'note_add',     route: '/app/notes',     color: '#00D9FF' },
    { label: 'Add Bill',     icon: 'add_card',     route: '/app/bills',     color: '#FF6584' },
    { label: 'Split Bill',   icon: 'groups',       route: '/app/splitwise', color: '#4ECCA3' },
  ];

  // ── "More Coming Soon" — Discover grid (loaded from backend) ──
  readonly discoverCategories = signal<DiscoverCategory[]>([]);
  readonly activeCategory = signal<DiscoverCategory | null>(null);

  /** Modal overlay element (rendered via *ngIf inside this component). */
  private readonly modalRef = viewChild<ElementRef<HTMLElement>>('discoverOverlay');

  constructor() {
    // Portal the modal element to document.body so position:fixed is honoured
    // even when an ancestor uses transform/filter (which would otherwise
    // create a new containing block and break fixed positioning).
    effect(() => {
      const overlay = this.modalRef()?.nativeElement;
      if (overlay && overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
      }
    });
  }

  ngOnDestroy(): void {
    // Defensive cleanup if user navigates away with modal open.
    document.body.style.overflow = '';
    const overlay = this.modalRef()?.nativeElement;
    if (overlay && overlay.parentElement === document.body) {
      document.body.removeChild(overlay);
    }
  }

  /** Loads the discover grid from the backend (cached in service). */
  private loadDiscover(): void {
    this.discoverSvc.getCategories().subscribe({
      next: cats => this.discoverCategories.set(cats ?? []),
      error: () => { /* non-fatal — grid simply stays empty */ },
    });
  }

  // ── Currency converter actions ───────────────────────────────
  setFxFrom(code: string): void { this.fxFrom.set(code); this.convertCurrency(); }
  setFxTo(code: string): void   { this.fxTo.set(code);   this.convertCurrency(); }
  setFxAmount(value: string): void {
    const n = parseFloat(value);
    this.fxAmount.set(isNaN(n) ? 0 : n);
    this.convertCurrency();
  }
  swapFx(): void {
    const from = this.fxFrom();
    this.fxFrom.set(this.fxTo());
    this.fxTo.set(from);
    this.convertCurrency();
  }
  convertCurrency(): void {
    const from = this.fxFrom();
    const to   = this.fxTo();
    const amt  = this.fxAmount();
    if (from === to) {
      this.fxRate.set(1);
      this.fxResult.set(amt);
      return;
    }
    this.fxLoading.set(true);
    this.fxError.set(false);

    // Primary: open.er-api.com (free, no key, CORS-enabled, reliable)
    const primary = `https://open.er-api.com/v6/latest/${from}`;
    // Fallback: frankfurter.app (ECB rates) if primary fails
    const fallback = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;

    const apply = (rate: number) => {
      this.fxRate.set(+rate.toFixed(4));
      this.fxResult.set(+(amt * rate).toFixed(2));
      this.fxLoading.set(false);
    };

    this.http.get<any>(primary).subscribe({
      next: (res) => {
        const rate = res?.rates?.[to];
        if (typeof rate === 'number') {
          apply(rate);
        } else {
          this.fetchFxFallback(fallback, to, apply);
        }
      },
      error: () => this.fetchFxFallback(fallback, to, apply),
    });
  }

  private fetchFxFallback(url: string, to: string, apply: (rate: number) => void): void {
    this.http.get<any>(url).subscribe({
      next: (res) => {
        const rate = res?.rates?.[to];
        if (typeof rate === 'number') {
          apply(rate);
        } else {
          this.fxError.set(true);
          this.fxLoading.set(false);
        }
      },
      error: () => {
        this.fxError.set(true);
        this.fxLoading.set(false);
      },
    });
  }

  openCategory(id: string): void {
    const cat = this.discoverCategories().find(c => c.id === id) ?? null;
    this.activeCategory.set(cat);
    document.body.style.overflow = 'hidden';
  }

  closeCategory(): void {
    this.activeCategory.set(null);
    document.body.style.overflow = '';
  }
}
