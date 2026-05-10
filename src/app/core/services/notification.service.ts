import { Injectable, inject } from '@angular/core';
import { signal, computed } from '@angular/core';
import { forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReminderService } from './reminder.service';
import { BillService } from './bill.service';
import { TodoService } from './todo.service';
import { MarketService } from './market.service';
import { WebSocketService } from './websocket.service';
import { ExpenseService } from './expense.service';
import { AuthService } from './auth.service';
import { Expense, ExpenseGroup, GroupMember } from '../../models/expense.model';

export type NotifCategory = 'reminder' | 'bill' | 'todo' | 'chat' | 'market' | 'splitwise';

export interface AppNotification {
  id: string;
  category: NotifCategory;
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  ts: number;   // Unix ms — used for sorting
  read: boolean;
}

const STORAGE_KEY = 'mantra_read_notifs';
const MAX_NOTIFS  = 50;   // cap panel size
const POLL_MS     = 3 * 60_000; // re-poll backend every 3 min

/** Builds a stable, deterministic ID so the same event is never duplicated. */
function makeId(category: string, ref: string): string {
  return `${category}:${ref}`;
}

/** Reads the set of already-read IDs from localStorage. */
function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Persists the read-set (capped to last 500 to avoid unbounded growth). */
function saveRead(set: Set<string>): void {
  try {
    const arr = [...set].slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* storage quota */ }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly reminderSvc = inject(ReminderService);
  private readonly billSvc     = inject(BillService);
  private readonly todoSvc     = inject(TodoService);
  private readonly marketSvc   = inject(MarketService);
  private readonly wsSvc       = inject(WebSocketService);
  private readonly expenseSvc  = inject(ExpenseService);
  private readonly authSvc     = inject(AuthService);

  /** Cache of memberId -> displayName, populated as groups are polled. */
  private readonly memberNames = new Map<string, string>();

  private readIds = loadRead();

  /** All notifications (newest first). */
  readonly all = signal<AppNotification[]>([]);

  /** Count of unread notifications. */
  readonly unreadCount = computed(() => this.all().filter(n => !n.read).length);

  /** Whether the notification panel is open. */
  readonly panelOpen = signal(false);

  // -----------------------------------------------------------------------
  // Lifecycle — call once after auth
  // -----------------------------------------------------------------------

  init(): void {
    this.poll();
    interval(POLL_MS).subscribe(() => this.poll());

    // Real-time: new chat messages via WebSocket
    this.wsSvc.newMessage$.subscribe(msg => {
      const id = makeId('chat', msg.id);
      if (this.readIds.has(id)) return;
      this.push({
        id,
        category: 'chat',
        icon: 'chat_bubble',
        iconColor: '#818cf8',
        title: 'New message',
        body: msg.senderDisplayName
          ? `${msg.senderDisplayName}: ${this.truncate(msg.content ?? '', 60)}`
          : this.truncate(msg.content ?? '', 70),
        ts: Date.now(),
        read: false,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Panel
  // -----------------------------------------------------------------------

  togglePanel(): void {
    this.panelOpen.update(v => !v);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  markRead(id: string): void {
    this.all.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
    this.readIds.add(id);
    saveRead(this.readIds);
  }

  markAllRead(): void {
    const ids = this.all().map(n => n.id);
    this.all.update(list => list.map(n => ({ ...n, read: true })));
    ids.forEach(id => this.readIds.add(id));
    saveRead(this.readIds);
  }

  dismiss(id: string): void {
    this.all.update(list => list.filter(n => n.id !== id));
    this.readIds.add(id);
    saveRead(this.readIds);
  }

  clearAll(): void {
    const ids = this.all().map(n => n.id);
    this.all.set([]);
    ids.forEach(id => this.readIds.add(id));
    saveRead(this.readIds);
  }

  // -----------------------------------------------------------------------
  // Polling
  // -----------------------------------------------------------------------

  private poll(): void {
    this.pollReminders();
    this.pollBills();
    this.pollTodos();
    this.pollMarket();
    this.pollSplitwise();
  }

  private pollReminders(): void {
    this.reminderSvc.getUpcoming().subscribe({
      next: (reminders) => {
        const now = Date.now();
        for (const r of reminders) {
          if (r.status !== 'PENDING') continue;

          const due = new Date(r.reminderTime).getTime();
          const diffMin = (due - now) / 60_000;

          // Only notify if due within 60 min or overdue by up to 24 h
          if (diffMin > 60 || diffMin < -1440) continue;

          const id = makeId('reminder', r.id);
          if (this.readIds.has(id)) continue;

          const overdue = diffMin < 0;
          this.push({
            id,
            category: 'reminder',
            icon: 'alarm',
            iconColor: overdue ? '#f87171' : '#fb923c',
            title: overdue ? 'Overdue reminder' : 'Upcoming reminder',
            body: r.title + (r.description ? ` — ${this.truncate(r.description, 50)}` : ''),
            ts: due,
            read: false,
          });
        }
      },
      error: () => { /* non-critical */ },
    });
  }

  private pollBills(): void {
    this.billSvc.getUpcoming().subscribe({
      next: (bills) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const b of bills) {
          if (b.status === 'PAID' || b.status === 'CANCELLED') continue;
          if (!b.dueDate) continue;

          const due = new Date(b.dueDate);
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

          // Notify only if due today, overdue, or due within 3 days
          if (diffDays > 3) continue;

          const id = makeId('bill', b.id);
          if (this.readIds.has(id)) continue;

          const overdue = diffDays < 0;
          this.push({
            id,
            category: 'bill',
            icon: 'receipt_long',
            iconColor: overdue ? '#f87171' : '#facc15',
            title: overdue ? `Bill overdue: ${b.title}` : `Bill due ${diffDays === 0 ? 'today' : `in ${diffDays}d`}: ${b.title}`,
            body: `${b.currency ?? 'USD'} ${b.amount.toFixed(2)} — ${b.category}`,
            ts: due.getTime(),
            read: false,
          });
        }
      },
      error: () => { /* non-critical */ },
    });
  }

  private pollTodos(): void {
    this.todoSvc.getAll().subscribe({
      next: (todos) => {
        const now = Date.now();
        for (const t of todos) {
          if (t.status === 'DONE' || t.status === 'CANCELLED') continue;
          if (!t.dueDate) continue;
          if (t.priority !== 'HIGH' && t.priority !== 'URGENT') continue;

          const due = new Date(t.dueDate).getTime();
          const diffMin = (due - now) / 60_000;

          // Only if overdue or due within 24 h
          if (diffMin > 1440) continue;

          const id = makeId('todo', t.id);
          if (this.readIds.has(id)) continue;

          const overdue = diffMin < 0;
          this.push({
            id,
            category: 'todo',
            icon: 'task_alt',
            iconColor: t.priority === 'URGENT' ? '#f87171' : '#a78bfa',
            title: overdue ? `Overdue task` : `Task due soon`,
            body: `[${t.priority}] ${t.title}`,
            ts: due,
            read: false,
          });
        }
      },
      error: () => { /* non-critical */ },
    });
  }

  private pollMarket(): void {
    this.marketSvc.getStockIndices().subscribe({
      next: (indices) => {
        for (const idx of indices) {
          const pct = idx.changePercent;
          if (Math.abs(pct) < 3) continue;  // only flag moves ≥ 3%

          // Use today's date in the ID so it fires once per day
          const dateKey = new Date().toISOString().slice(0, 10);
          const id = makeId('market', `${idx.symbol}:${dateKey}`);
          if (this.readIds.has(id)) continue;

          const up = pct > 0;
          this.push({
            id,
            category: 'market',
            icon: up ? 'trending_up' : 'trending_down',
            iconColor: up ? '#4ade80' : '#f87171',
            title: `${idx.name} ${up ? 'surging' : 'falling'}`,
            body: `${up ? '+' : ''}${pct.toFixed(2)}% today  (${idx.price.toLocaleString('en-US', { maximumFractionDigits: 2 })})`,
            ts: Date.now(),
            read: false,
          });
        }
      },
      error: () => { /* non-critical */ },
    });
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Polls all expense groups the user belongs to and surfaces splitwise
   * activity from the last 24 hours: new expenses involving the user (where
   * someone else paid), and groups the user was recently added to.
   */
  private pollSplitwise(): void {
    const me = this.authSvc.currentUser();
    if (!me?.userId) return;
    const myId = me.userId;
    const cutoff = Date.now() - 24 * 60 * 60_000;

    this.expenseSvc.getGroups().subscribe({
      next: (groups) => {
        if (!groups?.length) return;

        // Group-membership notifications (group.createdAt within 24h, not me as creator).
        for (const g of groups) {
          if (!g.memberIds?.includes(myId)) continue;
          if (g.createdById === myId) continue;
          const ts = new Date(g.createdAt).getTime();
          if (isNaN(ts) || ts < cutoff) continue;

          const id = makeId('splitwise', `group:${g.id}`);
          if (this.readIds.has(id)) continue;
          this.push({
            id,
            category: 'splitwise',
            icon: 'group_add',
            iconColor: '#4ECCA3',
            title: 'Added to a group',
            body: `${g.emoji ?? '💰'} ${g.name}`,
            ts,
            read: false,
          });
        }

        // For each group, fetch members (for names) + recent expenses.
        for (const g of groups) {
          if (!g.memberIds?.includes(myId)) continue;
          this.pollGroupExpenses(g, myId, cutoff);
        }
      },
      error: () => { /* non-critical */ },
    });
  }

  private pollGroupExpenses(group: ExpenseGroup, myId: string, cutoff: number): void {
    forkJoin({
      members:  this.expenseSvc.getGroupMembers(group.id).pipe(catchError(() => of([] as GroupMember[]))),
      expenses: this.expenseSvc.getGroupExpenses(group.id).pipe(catchError(() => of([] as Expense[]))),
    }).subscribe(({ members, expenses }) => {
      members.forEach(m => this.memberNames.set(m.userId, m.displayName));

      for (const e of expenses) {
        if (!e.createdAt) continue;
        const ts = new Date(e.createdAt).getTime();
        if (isNaN(ts) || ts < cutoff) continue;

        // Only notify when someone else paid and the user is in the split.
        if (e.paidById === myId) continue;
        if (!e.splits || e.splits[myId] == null) continue;

        const id = makeId('splitwise', `expense:${e.id}`);
        if (this.readIds.has(id)) continue;

        const payer = this.memberNames.get(e.paidById) ?? 'Someone';
        const share = Number(e.splits[myId]) || 0;
        const currency = e.currency || 'USD';
        const symbol = currency === 'USD' ? '$' : `${currency} `;

        this.push({
          id,
          category: 'splitwise',
          icon: 'receipt',
          iconColor: '#6C63FF',
          title: `${payer} added an expense`,
          body: `${this.truncate(e.description ?? 'Expense', 40)} — your share ${symbol}${share.toFixed(2)} · ${group.name}`,
          ts,
          read: false,
        });
      }
    });
  }

  /**
   * Adds a notification if it is not already in the list.
   * Maintains newest-first order and caps at MAX_NOTIFS.
   */
  private push(notif: AppNotification): void {
    this.all.update(list => {
      if (list.some(n => n.id === notif.id)) return list;
      const next = [notif, ...list].slice(0, MAX_NOTIFS);
      // Sort newest first
      next.sort((a, b) => b.ts - a.ts);
      return next;
    });
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + '…' : s;
  }
}
