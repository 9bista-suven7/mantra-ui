import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  adToBs, bsToAd, BsDate,
  BS_MONTH_EN, BS_MONTH_NE,
  WEEKDAY_SHORT_EN, WEEKDAY_SHORT_NE,
  toNepaliNum
} from '../../core/utils/nepali-date.util';
import { ReminderService } from '../../core/services/reminder.service';
import { HolidayService, Holiday } from '../../core/services/holiday.service';
import { Reminder, ReminderRequest, Priority } from '../../models/reminder.model';

export interface CalendarDay {
  adDate: Date;
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  isToday: boolean;
  inCurrentMonth: boolean;
  events: string[];
  holidays: Holiday[];
}

export interface LongWeekend {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  anchorHoliday: Holiday;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarComponent implements OnInit {

  private readonly reminderSvc = inject(ReminderService);
  private readonly holidaySvc  = inject(HolidayService);
  private readonly fb = inject(FormBuilder);

  /** 'en' = Gregorian primary, 'ne' = Bikram Sambat primary */
  readonly mode = signal<'en' | 'ne'>('en');

  private readonly _today = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  })();

  private readonly _todayBs: BsDate = adToBs(this._today);

  readonly viewAd = signal({ year: this._today.getFullYear(), month: this._today.getMonth() });
  readonly viewBs = signal({ year: this._todayBs.year, month: this._todayBs.month });

  /** All reminders (reloaded on any mutation) */
  private readonly allReminders = signal<Reminder[]>([]);

  /** All holidays (US + Nepal) for relevant years. */
  readonly allHolidays = signal<Holiday[]>([]);

  /** The date whose reminders are shown in the side panel */
  readonly selectedDate = signal<Date>(this._today);

  /** Whether the inline add-form is open */
  readonly showAddForm = signal(false);

  /** Reminder form */
  readonly form = this.fb.group({
    title:        ['', Validators.required],
    description:  [''],
    reminderTime: ['', Validators.required],
    priority:     ['MEDIUM'],
    recurrence:   ['NONE']
  });

  readonly priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'LOW',    label: 'Low',    color: '#4ECCA3' },
    { value: 'MEDIUM', label: 'Medium', color: '#FFB347' },
    { value: 'HIGH',   label: 'High',   color: '#FF6584' },
    { value: 'URGENT', label: 'Urgent', color: '#FF4444' },
  ];

  // ── Computed labels ────────────────────────────────────────────────────

  readonly weekDays = computed(() =>
    this.mode() === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_NE
  );

  readonly headerLabel = computed(() => {
    if (this.mode() === 'en') {
      const { year, month } = this.viewAd();
      return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const { year, month } = this.viewBs();
    return `${BS_MONTH_NE[month - 1]}  ${toNepaliNum(year)} BS`;
  });

  readonly subLabel = computed(() => {
    const mid = this.calDays()[20];
    if (this.mode() === 'en') return `${BS_MONTH_EN[mid.bsMonth - 1]} ${mid.bsYear} BS`;
    return mid.adDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + ' AD';
  });

  readonly todayAdLabel = computed(() =>
    this._today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  );

  readonly todayBsLabel = computed(() => {
    const bs = this._todayBs;
    return `${BS_MONTH_EN[bs.month - 1]} ${bs.day}, ${bs.year} BS  |  ${BS_MONTH_NE[bs.month - 1]} ${toNepaliNum(bs.day)}, ${toNepaliNum(bs.year)} BS`;
  });

  // ── Reminders for selected day ─────────────────────────────────────────

  readonly selectedDateStr = computed(() => this.selectedDate().toISOString().slice(0, 10));

  readonly selectedReminders = computed(() =>
    this.allReminders().filter(r => r.reminderTime?.slice(0, 10) === this.selectedDateStr())
  );

  readonly selectedDateLabel = computed(() =>
    this.selectedDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  );

  // ── Calendar grid ──────────────────────────────────────────────────────

  readonly calDays = computed<CalendarDay[]>(() => {
    const mode   = this.mode();
    const viewAd = this.viewAd();
    const viewBs = this.viewBs();
    const rems   = this.allReminders();
    const hols   = this.allHolidays();
    const selStr = this.selectedDateStr();

    const firstOfMonth: Date = mode === 'en'
      ? new Date(viewAd.year, viewAd.month, 1)
      : bsToAd(viewBs.year, viewBs.month, 1);

    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());

    const today = this._today;
    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const adDate = new Date(start);
      adDate.setDate(start.getDate() + i);
      adDate.setHours(0, 0, 0, 0);

      const bs = adToBs(adDate);
      const inCurrentMonth = mode === 'en'
        ? adDate.getFullYear() === viewAd.year && adDate.getMonth() === viewAd.month
        : bs.year === viewBs.year && bs.month === viewBs.month;

      const adStr = adDate.toISOString().slice(0, 10);
      const events = rems.filter(r => r.reminderTime?.slice(0, 10) === adStr).map(r => r.title);
      const dayHolidays = hols.filter(h => h.date === adStr);

      days.push({ adDate, bsYear: bs.year, bsMonth: bs.month, bsDay: bs.day,
                  isToday: adDate.getTime() === today.getTime(), inCurrentMonth, events,
                  holidays: dayHolidays });
    }
    return days;
  });

  readonly calWeeks = computed(() => {
    const days = this.calDays();
    const weeks: CalendarDay[][] = [];
    for (let r = 0; r < 6; r++) weeks.push(days.slice(r * 7, r * 7 + 7));
    return weeks;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadReminders();
    this.loadHolidays();
  }

  /** Loads holidays for current year and next year so the long-weekend lookahead spans year boundaries. */
  private loadHolidays(): void {
    const year = this._today.getFullYear();
    this.holidaySvc.getHolidays(year).subscribe(list1 => {
      this.holidaySvc.getHolidays(year + 1).subscribe(list2 => {
        this.allHolidays.set([...list1, ...list2].sort((a, b) => a.date.localeCompare(b.date)));
      });
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────

  setMode(m: 'en' | 'ne'): void { this.mode.set(m); }

  prevMonth(): void {
    if (this.mode() === 'en') {
      this.viewAd.update(v => { let month = v.month - 1, year = v.year; if (month < 0) { month = 11; year--; } return { year, month }; });
      this._syncBsFromAd();
    } else {
      this.viewBs.update(v => { let month = v.month - 1, year = v.year; if (month < 1) { month = 12; year--; } return { year, month }; });
      this._syncAdFromBs();
    }
  }

  nextMonth(): void {
    if (this.mode() === 'en') {
      this.viewAd.update(v => { let month = v.month + 1, year = v.year; if (month > 11) { month = 0; year++; } return { year, month }; });
      this._syncBsFromAd();
    } else {
      this.viewBs.update(v => { let month = v.month + 1, year = v.year; if (month > 12) { month = 1; year++; } return { year, month }; });
      this._syncAdFromBs();
    }
  }

  goToday(): void {
    this.viewAd.set({ year: this._today.getFullYear(), month: this._today.getMonth() });
    this.viewBs.set({ year: this._todayBs.year, month: this._todayBs.month });
    this.selectDay(this._today);
  }

  selectDay(date: Date): void {
    this.selectedDate.set(date);
    this.showAddForm.set(false);
    // Pre-fill the datetime input: current time (+5 min buffer) for today, 09:00 for other days
    this.form.patchValue({ reminderTime: this.defaultReminderIso(date) });
  }

  /** Returns a datetime-local string. For today uses now+5min so it stays in the future; otherwise 09:00. */
  private defaultReminderIso(date: Date): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(date); target.setHours(0, 0, 0, 0);
    const dt = target.getTime() === today.getTime()
      ? new Date(Date.now() + 5 * 60 * 1000)  // now + 5 min
      : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  isSelected(d: CalendarDay): boolean {
    return d.adDate.getTime() === this.selectedDate().getTime();
  }

  // ── Reminder CRUD ──────────────────────────────────────────────────────

  loadReminders(): void {
    this.reminderSvc.getAll().subscribe({
      next: r => this.allReminders.set(r),
      error: () => { /* non-fatal */ }
    });
  }

  openAddForm(): void {
    const iso = this.defaultReminderIso(this.selectedDate());
    this.form.reset({ priority: 'MEDIUM', recurrence: 'NONE', reminderTime: iso });
    this.showAddForm.set(true);
  }

  saveReminder(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    const req: ReminderRequest = {
      title:        v.title!,
      description:  v.description ?? '',
      reminderTime: new Date(v.reminderTime!).toISOString(),
      priority:     (v.priority as Priority) ?? 'MEDIUM',
      recurrence:   (v.recurrence as any) ?? 'NONE'
    };
    this.reminderSvc.create(req).subscribe(() => {
      this.showAddForm.set(false);
      this.loadReminders();
    });
  }

  completeReminder(id: string): void {
    this.reminderSvc.complete(id).subscribe(() => this.loadReminders());
  }

  deleteReminder(id: string): void {
    this.reminderSvc.delete(id).subscribe(() => this.loadReminders());
  }

  isOverdue(r: Reminder): boolean {
    return r.status === 'PENDING' && new Date(r.reminderTime) < new Date();
  }

  priorityConfig(p: Priority) {
    return this.priorities.find(x => x.value === p) ?? this.priorities[1];
  }

  // ── Display helpers ────────────────────────────────────────────────────

  primaryDay(d: CalendarDay): string {
    return this.mode() === 'en' ? String(d.adDate.getDate()) : toNepaliNum(d.bsDay);
  }

  secondaryDay(d: CalendarDay): string {
    return this.mode() === 'en' ? String(d.bsDay) : String(d.adDate.getDate());
  }

  private _syncBsFromAd(): void {
    const { year, month } = this.viewAd();
    const bs = adToBs(new Date(year, month, 15));
    this.viewBs.set({ year: bs.year, month: bs.month });
  }

  private _syncAdFromBs(): void {
    const { year, month } = this.viewBs();
    const ad = bsToAd(year, month, 15);
    this.viewAd.set({ year: ad.getFullYear(), month: ad.getMonth() });
  }

  trackByDate(_: number, d: CalendarDay): number { return d.adDate.getTime(); }

  // ── Holidays card filter & helpers ─────────────────────────────────────

  readonly holFilter = signal<'all' | 'US' | 'NP'>('all');

  /** Holidays from today onward (limited to ~12 months ahead), filtered by tab. */
  readonly filteredHolidays = computed(() => {
    const todayStr = this._today.toISOString().slice(0, 10);
    const filter = this.holFilter();
    return this.allHolidays()
      .filter(h => h.date >= todayStr)
      .filter(h => filter === 'all' ? true : h.country === filter)
      .slice(0, 60);
  });

  parseHolidayDate(dateStr: string): Date {
    // YYYY-MM-DD interpreted as local date (avoid TZ shift).
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  holidayMonth(dateStr: string): string {
    return this.parseHolidayDate(dateStr).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  }
  holidayDay(dateStr: string): string {
    return String(this.parseHolidayDate(dateStr).getDate());
  }
  holidayWeekday(dateStr: string): string {
    return this.parseHolidayDate(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  }
  holidayWhenLabel(dateStr: string): string {
    const days = Math.round((this.parseHolidayDate(dateStr).getTime() - this._today.getTime()) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `in ${days}d`;
    if (days < 30) return `in ${Math.round(days / 7)}w`;
    if (days < 365) return `in ${Math.round(days / 30)}mo`;
    return `in ${Math.round(days / 365)}y`;
  }

  // ── Long-weekend detection ─────────────────────────────────────────────

  /**
   * Detects the next "long weekend" in the upcoming 90 days. A long weekend
   * is any contiguous run of 3 or more days off (Sat, Sun, or US federal
   * holiday) starting on or after today.
   */
  readonly nextLongWeekend = computed<LongWeekend | null>(() => {
    const hols = this.allHolidays();
    if (!hols.length) return null;

    // Build a quick lookup for US federal off-days.
    const usDayOff = new Set(hols.filter(h => h.country === 'US' && h.isPublic).map(h => h.date));
    const holidayByDate = new Map<string, Holiday>();
    hols.filter(h => h.country === 'US' && h.isPublic).forEach(h => holidayByDate.set(h.date, h));

    const isOff = (d: Date): boolean => {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return true;
      return usDayOff.has(d.toISOString().slice(0, 10));
    };

    const start = new Date(this._today);
    for (let offset = 0; offset < 90; offset++) {
      const cursor = new Date(start);
      cursor.setDate(start.getDate() + offset);
      if (!isOff(cursor)) continue;

      // Found an off-day. Walk backward only if today is mid-streak (not relevant for "next").
      // Walk forward to find the streak end.
      const streakStart = new Date(cursor);
      let streakEnd = new Date(cursor);
      while (true) {
        const nxt = new Date(streakEnd);
        nxt.setDate(streakEnd.getDate() + 1);
        if (!isOff(nxt)) break;
        streakEnd = nxt;
      }
      const days = Math.round((streakEnd.getTime() - streakStart.getTime()) / 86400000) + 1;
      if (days >= 3) {
        const anchor =
          [...holidayByDate.values()].find(h => {
            const t = new Date(h.date).getTime();
            return t >= streakStart.getTime() && t <= streakEnd.getTime();
          }) ?? { date: streakStart.toISOString().slice(0, 10), name: 'Weekend', country: 'US' as const, isPublic: false };
        return { startDate: streakStart, endDate: streakEnd, totalDays: days, anchorHoliday: anchor };
      }
      // Skip ahead past this streak so we keep scanning for the *next* one.
      offset += days - 1;
    }
    return null;
  });

  longWeekendLabel(): string {
    const lw = this.nextLongWeekend();
    if (!lw) return '';
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(lw.startDate)} – ${fmt(lw.endDate)}`;
  }

  longWeekendDaysAway(): number {
    const lw = this.nextLongWeekend();
    if (!lw) return 0;
    return Math.max(0, Math.round((lw.startDate.getTime() - this._today.getTime()) / 86400000));
  }
}
