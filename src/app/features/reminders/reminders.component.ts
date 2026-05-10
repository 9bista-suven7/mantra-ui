import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Reminder, ReminderRequest, Priority } from '../../models/reminder.model';
import { ReminderService } from '../../core/services/reminder.service';
import { CustomSelectComponent, SelectOption } from '../../shared/components/custom-select/custom-select.component';

type FilterKey = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

interface ReminderGroup {
  key: string;
  label: string;
  icon: string;
  items: Reminder[];
}

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RemindersComponent implements OnInit {

  private readonly svc = inject(ReminderService);
  private readonly fb = inject(FormBuilder);

  readonly reminders = signal<Reminder[]>([]);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly editId = signal<string | null>(null);
  readonly filter = signal<FilterKey>('all');
  readonly search = signal('');

  readonly form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    reminderTime: ['', Validators.required],
    priority: ['MEDIUM'],
    recurrence: ['NONE']
  });

  readonly priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'LOW',    label: 'Low',    color: '#4ECCA3' },
    { value: 'MEDIUM', label: 'Medium', color: '#FFB347' },
    { value: 'HIGH',   label: 'High',   color: '#FF6584' },
    { value: 'URGENT', label: 'Urgent', color: '#FF4444' },
  ];

  // ── Custom-select option lists ──
  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({ value: p.value, label: p.label }));
  }
  readonly recurrenceOptions: SelectOption[] = [
    { value: 'NONE',    label: 'One-time' },
    { value: 'DAILY',   label: 'Daily' },
    { value: 'WEEKLY',  label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  readonly filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'all',       label: 'All',       icon: 'inbox' },
    { key: 'today',     label: 'Today',     icon: 'today' },
    { key: 'upcoming',  label: 'Upcoming',  icon: 'event_upcoming' },
    { key: 'overdue',   label: 'Overdue',   icon: 'warning' },
    { key: 'completed', label: 'Completed', icon: 'check_circle' },
  ];

  readonly stats = computed(() => {
    const all = this.reminders();
    const now = new Date();
    const isToday = (d: Date) => d.toDateString() === now.toDateString();
    return {
      total: all.length,
      today: all.filter(r => r.status !== 'COMPLETED' && isToday(new Date(r.reminderTime))).length,
      overdue: all.filter(r => this.isOverdue(r)).length,
      done: all.filter(r => r.status === 'COMPLETED').length,
    };
  });

  readonly filteredReminders = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    const now = new Date();
    return this.reminders()
      .filter(r => {
        if (q && !r.title.toLowerCase().includes(q) &&
            !(r.description ?? '').toLowerCase().includes(q)) return false;
        switch (f) {
          case 'today':
            return r.status !== 'COMPLETED' &&
              new Date(r.reminderTime).toDateString() === now.toDateString();
          case 'upcoming':
            return r.status !== 'COMPLETED' && new Date(r.reminderTime) >= now;
          case 'overdue':   return this.isOverdue(r);
          case 'completed': return r.status === 'COMPLETED';
          default:          return true;
        }
      })
      .sort((a, b) => +new Date(a.reminderTime) - +new Date(b.reminderTime));
  });

  readonly groupedReminders = computed<ReminderGroup[]>(() => {
    const list = this.filteredReminders();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
    const startDayAfter = new Date(startTomorrow); startDayAfter.setDate(startDayAfter.getDate() + 1);
    const startNextWeek = new Date(startToday); startNextWeek.setDate(startNextWeek.getDate() + 7);

    const overdue: Reminder[] = [];
    const today: Reminder[] = [];
    const tomorrow: Reminder[] = [];
    const week: Reminder[] = [];
    const later: Reminder[] = [];
    const done: Reminder[] = [];

    for (const r of list) {
      const d = new Date(r.reminderTime);
      if (r.status === 'COMPLETED') done.push(r);
      else if (d < startToday) overdue.push(r);
      else if (d < startTomorrow) today.push(r);
      else if (d < startDayAfter) tomorrow.push(r);
      else if (d < startNextWeek) week.push(r);
      else later.push(r);
    }

    const groups: ReminderGroup[] = [
      { key: 'overdue',  label: 'Overdue',   icon: 'warning',        items: overdue  },
      { key: 'today',    label: 'Today',     icon: 'wb_sunny',       items: today    },
      { key: 'tomorrow', label: 'Tomorrow',  icon: 'event',          items: tomorrow },
      { key: 'week',     label: 'This Week', icon: 'date_range',     items: week     },
      { key: 'later',    label: 'Later',     icon: 'event_upcoming', items: later    },
      { key: 'done',     label: 'Completed', icon: 'check_circle',   items: done     },
    ];
    return groups.filter(g => g.items.length > 0);
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: r => { this.reminders.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setFilter(f: FilterKey): void { this.filter.set(f); }
  onSearch(v: string): void { this.search.set(v); }

  openForm(reminder?: Reminder): void {
    if (reminder) {
      this.editId.set(reminder.id);
      const dt = new Date(reminder.reminderTime).toISOString().slice(0, 16);
      this.form.patchValue({ ...reminder, reminderTime: dt });
    } else {
      this.editId.set(null);
      this.form.reset({ priority: 'MEDIUM', recurrence: 'NONE' });
    }
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    const req: ReminderRequest = {
      title: v.title!,
      description: v.description ?? '',
      reminderTime: new Date(v.reminderTime!).toISOString(),
      priority: (v.priority as any) ?? 'MEDIUM',
      recurrence: (v.recurrence as any) ?? 'NONE'
    };
    const op = this.editId()
      ? this.svc.update(this.editId()!, req)
      : this.svc.create(req);

    op.subscribe(() => {
      this.showForm.set(false);
      this.load();
    });
  }

  complete(id: string): void {
    this.svc.complete(id).subscribe(() => this.load());
  }

  delete(id: string): void {
    this.svc.delete(id).subscribe(() => this.load());
  }

  priorityConfig(p: Priority) {
    return this.priorities.find(x => x.value === p) ?? this.priorities[1];
  }

  isOverdue(r: Reminder): boolean {
    return r.status === 'PENDING' && new Date(r.reminderTime) < new Date();
  }

  relativeTime(iso: string): string {
    const target = new Date(iso).getTime();
    const diffMs = target - Date.now();
    const absMin = Math.round(Math.abs(diffMs) / 60000);
    const past = diffMs < 0;
    if (absMin < 1) return 'just now';
    if (absMin < 60) return past ? `${absMin}m ago` : `in ${absMin}m`;
    const absH = Math.round(absMin / 60);
    if (absH < 24) return past ? `${absH}h ago` : `in ${absH}h`;
    const absD = Math.round(absH / 24);
    if (absD < 7) return past ? `${absD}d ago` : `in ${absD}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
