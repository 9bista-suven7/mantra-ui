import {
  afterEveryRender, ChangeDetectionStrategy, Component, computed, inject, OnInit, signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, catchError } from 'rxjs/operators';
import {
  ExpenseGroup, GroupMember, Expense, BalanceSummary, PaymentSuggestion,
  AddExpenseRequest, SettleRequest
} from '../../models/expense.model';
import { ExpenseService } from '../../core/services/expense.service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-splitwise',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './splitwise.component.html',
  styleUrl: './splitwise.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SplitwiseComponent implements OnInit {

  private readonly svc = inject(ExpenseService);
  private readonly fb  = inject(FormBuilder);

  // ── Core state ─────────────────────────────────────────────────────────────
  readonly groups        = signal<ExpenseGroup[]>([]);
  readonly selectedGroup = signal<ExpenseGroup | null>(null);
  readonly groupMembers  = signal<GroupMember[]>([]);
  readonly expenses      = signal<Expense[]>([]);
  readonly balances      = signal<BalanceSummary | null>(null);
  readonly loading       = signal(false);

  // ── Modal flags ────────────────────────────────────────────────────────────
  readonly showCreateGroup = signal(false);
  readonly showAddExpense  = signal(false);
  readonly groupError    = signal<string | null>(null);
  readonly expenseError  = signal<string | null>(null);
  readonly showSettle      = signal(false);
  readonly settleTarget    = signal<{ toUserId: string; toName: string; amount: number } | null>(null);
  readonly showMemberDetail      = signal(false);
  readonly selectedBalanceMember = signal<string | null>(null);
  readonly allGroupBalances      = signal<Record<string, BalanceSummary>>({});
  readonly summaryLoading        = signal(false);
  readonly showProfilePanel      = signal(false);
  readonly showDeleteGroupConfirm = signal(false);
  readonly showManageMembers = signal(false);
  readonly memberMgmtError  = signal<string | null>(null);
  readonly memberMgmtLoading = signal(false);

  // ── SVG connector signals ─────────────────────────────────────────────────
  readonly flowPath1 = signal('');
  readonly flowPath2 = signal('');
  readonly flowDot1  = signal<{x: number; y: number}>({x: 0, y: 0});
  readonly flowDot2  = signal<{x: number; y: number}>({x: 0, y: 0});

  constructor() {
    afterEveryRender(() => { this.updateFlowPaths(); });
  }

  /** True when the current user is the creator of the selected group. */
  readonly isGroupCreator = computed(() =>
    !!this.selectedGroup() && this.selectedGroup()!.createdById === this.currentUserId()
  );

  // ── Add-expense reactive state ─────────────────────────────────────────────
  readonly expenseAmount     = signal(0);
  readonly expenseSplitType  = signal<'EQUAL' | 'EXACT'>('EQUAL');
  readonly paidByUserIdSig   = signal('');
  /** Members selected to be included in this expense */
  readonly selectedMemberIds = signal<string[]>([]);
  /** userId → manually locked amount; absent = auto-share */
  readonly lockedAmounts     = signal<Record<string, number>>({});

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly memberMap = computed(() =>
    Object.fromEntries(this.groupMembers().map(m => [m.userId, m]))
  );

  readonly netBalancesWithNames = computed(() => {
    const nb  = this.balances()?.netBalances ?? {};
    const map = this.memberMap();
    const entries = Object.entries(nb).map(([uid, amt]) => ({
      userId:      uid,
      displayName: map[uid]?.displayName ?? uid,
      initials:    map[uid]?.initials ?? '?',
      amount:      Number(amt)
    })).sort((a, b) => b.amount - a.amount);
    const maxAbs = Math.max(...entries.map(e => Math.abs(e.amount)), 1);
    return entries.map(e => ({ ...e, barPct: Math.round(Math.abs(e.amount) / maxAbs * 100) }));
  });

  /** Amount auto-assigned to each unlocked selected member */
  readonly autoShareValue = computed(() => {
    const total    = this.expenseAmount();
    const selected = this.selectedMemberIds();
    const locked   = this.lockedAmounts();
    const lockedTotal = selected.reduce((s, id) => s + (locked[id] ?? 0), 0);
    const unlocked = selected.filter(id => locked[id] === undefined);
    if (!unlocked.length || total <= 0) return 0;
    return Math.round(((total - lockedTotal) / unlocked.length) * 100) / 100;
  });

  /** Final per-member splits: locked value OR auto-share */
  readonly effectiveSplits = computed<Record<string, number>>(() => {
    const total    = this.expenseAmount();
    const selected = this.selectedMemberIds();
    const locked   = this.lockedAmounts();
    const lockedTotal = selected.reduce((s, id) => s + (locked[id] ?? 0), 0);
    const unlocked = selected.filter(id => locked[id] === undefined);
    const autoShare = unlocked.length > 0
      ? Math.round(((total - lockedTotal) / unlocked.length) * 100) / 100
      : 0;
    const result: Record<string, number> = {};
    selected.forEach(id => {
      result[id] = locked[id] !== undefined ? locked[id] : Math.max(0, autoShare);
    });
    return result;
  });

  readonly unlockedCount = computed(() => {
    const locked = this.lockedAmounts();
    return this.selectedMemberIds().filter(id => locked[id] === undefined).length;
  });

  readonly effectiveTotal = computed(() =>
    Math.round(Object.values(this.effectiveSplits()).reduce((s, v) => s + v, 0) * 100) / 100
  );

  readonly splitProgressPct = computed(() => {
    const total = this.expenseAmount();
    if (total <= 0) return 0;
    return Math.min(100, Math.round(this.effectiveTotal() / total * 100));
  });

  readonly memberDetailData = computed(() => {
    const memberId = this.selectedBalanceMember();
    if (!memberId) return null;
    const myId = this.currentUserId();
    const suggestions = this.balances()?.suggestions ?? [];
    const expenseList = this.expenses();
    const map = this.memberMap();
    const member = map[memberId];
    const isSelf = memberId === myId;
    const toReceive = suggestions.filter(s => s.toUserId === myId);
    const toPay     = suggestions.filter(s => s.fromUserId === myId);
    const totalReceive = Math.round(toReceive.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    const totalPay     = Math.round(toPay.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    const iOwe    = suggestions.find(s => s.fromUserId === myId && s.toUserId === memberId) ?? null;
    const theyOwe = suggestions.find(s => s.fromUserId === memberId && s.toUserId === myId) ?? null;
    const sharedExpenses = expenseList.filter(exp => {
      const splits = exp.splits ?? {};
      return (myId in splits && memberId in splits) ||
             (exp.paidById === myId && memberId in splits) ||
             (exp.paidById === memberId && myId in splits);
    });
    return { isSelf, member, toReceive, toPay, totalReceive, totalPay, iOwe, theyOwe, sharedExpenses };
  });

  /** Personal balance summary across all loaded groups. */
  readonly myPersonalSummary = computed(() => {
    const myId = this.currentUserId();
    const allBal = this.allGroupBalances();
    const grps   = this.groups();
    let totalOwed = 0;
    let totalOwe  = 0;
    const rows: { group: ExpenseGroup; net: number; currency: string }[] = [];
    for (const [gId, summary] of Object.entries(allBal)) {
      const net = Number((summary.netBalances ?? {})[myId] ?? 0);
      const group = grps.find(g => g.id === gId);
      if (!group) continue;
      if (net > 0.005)  totalOwed += net;
      else if (net < -0.005) totalOwe += Math.abs(net);
      if (Math.abs(net) > 0.005) rows.push({ group, net, currency: summary.currency ?? 'USD' });
    }
    rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    const totalOwedR = Math.round(totalOwed * 100) / 100;
    const totalOweR  = Math.round(totalOwe  * 100) / 100;
    return {
      totalOwed: totalOwedR,
      totalOwe:  totalOweR,
      /** Signed net = (owed to me) - (I owe). Positive = I receive, negative = I pay. */
      netTotal:  Math.round((totalOwedR - totalOweR) * 100) / 100,
      rows
    };
  });

  /** Per-person aggregated net balance across ALL groups.
   *  A given member appears in EXACTLY ONE bucket: if the per-person net is
   *  positive (they owe me) the entry is in `owedToMe`; if negative the entry
   *  is in `iOwe`. This avoids the case where a person shows up in both
   *  buckets due to opposite-sign suggestions across different groups. */
  readonly myPersonalDetail = computed(() => {
    const myId = this.currentUserId();
    const allBal = this.allGroupBalances();
    /** memberId -> { name, signedTotal, currency } where signed = (they owe me) - (I owe them). */
    const netMap: Record<string, { name: string; total: number; currency: string }> = {};

    for (const summary of Object.values(allBal)) {
      const cur = summary.currency ?? 'USD';
      for (const s of (summary.suggestions ?? [])) {
        if (s.fromUserId === myId) {
          if (!netMap[s.toUserId]) netMap[s.toUserId] = { name: s.toDisplayName, total: 0, currency: cur };
          netMap[s.toUserId].total -= s.amount;
        } else if (s.toUserId === myId) {
          if (!netMap[s.fromUserId]) netMap[s.fromUserId] = { name: s.fromDisplayName, total: 0, currency: cur };
          netMap[s.fromUserId].total += s.amount;
        }
      }
    }

    const owedToMe: { userId: string; name: string; total: number; currency: string }[] = [];
    const iOwe:     { userId: string; name: string; total: number; currency: string }[] = [];
    for (const [uid, v] of Object.entries(netMap)) {
      const rounded = Math.round(v.total * 100) / 100;
      if (rounded > 0.005) owedToMe.push({ userId: uid, name: v.name, total: rounded, currency: v.currency });
      else if (rounded < -0.005) iOwe.push({ userId: uid, name: v.name, total: Math.abs(rounded), currency: v.currency });
    }
    owedToMe.sort((a, b) => b.total - a.total);
    iOwe.sort((a, b) => b.total - a.total);
    return { iOwe, owedToMe };
  });

  /** Sum of “owed to you” rows currently displayed (for the section header). */
  readonly personalDetailTotalOwed = computed(() =>
    Math.round(this.myPersonalDetail().owedToMe.reduce((s, r) => s + r.total, 0) * 100) / 100
  );

  /** Sum of “you owe” rows currently displayed (for the section header). */
  readonly personalDetailTotalOwe = computed(() =>
    Math.round(this.myPersonalDetail().iOwe.reduce((s, r) => s + r.total, 0) * 100) / 100
  );

  // ── Forms ──────────────────────────────────────────────────────────────────
  readonly groupForm = this.fb.group({
    name:         ['', Validators.required],
    description:  [''],
    category:     ['OTHER'],
    memberEmails: [''],
  });

  readonly expenseForm = this.fb.group({
    description: ['', Validators.required],
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:    ['USD'],
    expenseDate: ['']
  });

  readonly settleForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    notes:  ['']
  });

  readonly addMemberForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly addMemberFormValid = toSignal(
    this.addMemberForm.statusChanges.pipe(map(s => s === 'VALID')),
    { initialValue: this.addMemberForm.valid }
  );

  // Signal-based form validity (needed for OnPush + zoneless — Observable statusChanges
  // don't trigger CD automatically, so [disabled] bindings must use signals)
  readonly groupFormValid   = toSignal(this.groupForm.statusChanges.pipe(map(s => s === 'VALID')),   { initialValue: this.groupForm.valid });
  readonly expenseFormValid = toSignal(this.expenseForm.statusChanges.pipe(map(s => s === 'VALID')), { initialValue: this.expenseForm.valid });
  readonly settleFormValid  = toSignal(this.settleForm.statusChanges.pipe(map(s => s === 'VALID')),  { initialValue: this.settleForm.valid });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void { this.loadGroups(); }

  // ── Groups ─────────────────────────────────────────────────────────────────
  loadGroups(): void {
    this.svc.getGroups().subscribe(groups => {
      this.groups.set(groups);
      if (!groups.length) return;
      this.summaryLoading.set(true);
      const calls = Object.fromEntries(
        groups.map(g => [g.id, this.svc.getGroupBalances(g.id).pipe(catchError(() => of(null)))])
      );
      forkJoin(calls).subscribe(results => {
        const map: Record<string, BalanceSummary> = {};
        for (const [gId, res] of Object.entries(results)) {
          const b = res ? (res as any).data ?? res : null;
          if (b) map[gId] = b;
        }
        this.allGroupBalances.set(map);
        this.summaryLoading.set(false);
      });
    });
  }

  selectGroup(group: ExpenseGroup): void {
    this.selectedGroup.set(group);
    this.showProfilePanel.set(false);
    this.loading.set(true);
    forkJoin({
      members:  this.svc.getGroupMembers(group.id).pipe(catchError(() => of([]))),
      expenses: this.svc.getGroupExpenses(group.id).pipe(catchError(() => of([]))),
      balances: this.svc.getGroupBalances(group.id).pipe(catchError(() => of(null)))
    }).subscribe(({ members, expenses, balances }) => {
      this.groupMembers.set(members as GroupMember[]);
      this.expenses.set(expenses as Expense[]);
      const b = balances ? (balances as any).data ?? balances : null;
      this.balances.set(b);
      if (b) this.allGroupBalances.update(m => ({ ...m, [group.id]: b }));
      this.loading.set(false);
      this.paidByUserIdSig.set(this.currentUserId());
    });
  }

  createGroup(): void {
    this.groupForm.markAllAsTouched();
    if (this.groupForm.invalid) {
      this.groupError.set('Please fill in the group name.');
      return;
    }
    this.groupError.set(null);
    const v = this.groupForm.value;
    const memberEmails = v.memberEmails
      ? v.memberEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
    this.svc.createGroup({
      name: v.name!, description: v.description ?? '',
      emoji: '💰', category: v.category ?? 'OTHER', memberEmails
    }).subscribe({
      next: () => {
        this.showCreateGroup.set(false);
        this.groupForm.reset({ category: 'OTHER' });
        this.groupError.set(null);
        this.loadGroups();
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Failed to create group. Please try again.';
        this.groupError.set(msg);
      }
    });
  }

  // ── Expense ────────────────────────────────────────────────────────────────
  openAddExpense(): void {
    this.expenseForm.reset({ currency: 'USD', expenseDate: '' });
    this.expenseAmount.set(0);
    this.expenseSplitType.set('EQUAL');
    this.paidByUserIdSig.set(this.currentUserId());
    this.selectedMemberIds.set(this.groupMembers().map(m => m.userId));
    this.lockedAmounts.set({});
    this.expenseError.set(null);
    this.showAddExpense.set(true);
  }

  onAmountChange(value: string): void {
    this.expenseAmount.set(Number(value) || 0);
  }

  setSplitType(type: 'EQUAL' | 'EXACT'): void {
    this.expenseSplitType.set(type);
    this.lockedAmounts.set({});
  }

  toggleMember(userId: string): void {
    this.selectedMemberIds.update(ids =>
      ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId]
    );
    this.lockedAmounts.update(l => { const n = { ...l }; delete n[userId]; return n; });
  }

  selectAllMembers(): void {
    this.selectedMemberIds.set(this.groupMembers().map(m => m.userId));
  }

  setLockedSplit(userId: string, value: string): void {
    const num = parseFloat(value);
    if (value === '' || isNaN(num)) {
      this.lockedAmounts.update(l => { const n = { ...l }; delete n[userId]; return n; });
    } else {
      this.lockedAmounts.update(l => ({ ...l, [userId]: Math.max(0, num) }));
    }
  }

  clearLockedSplit(userId: string): void {
    this.lockedAmounts.update(l => { const n = { ...l }; delete n[userId]; return n; });
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMemberIds().includes(userId);
  }

  isAmountLocked(userId: string): boolean {
    return this.lockedAmounts()[userId] !== undefined;
  }

  addExpense(): void {
    this.expenseForm.markAllAsTouched();
    if (this.expenseForm.invalid || !this.selectedGroup()) return;
    const v        = this.expenseForm.value;
    const amount   = this.expenseAmount() || Number(v.amount) || 0;
    const type     = this.expenseSplitType();
    const selected = this.selectedMemberIds();
    const allSelected = selected.length === this.groupMembers().length;

    const req: AddExpenseRequest = {
      description:  v.description!,
      amount,
      currency:     v.currency ?? 'USD',
      splitType:    (type === 'EQUAL' && allSelected) ? 'EQUAL' : 'EXACT',
      expenseDate:  v.expenseDate ? new Date(v.expenseDate).toISOString() : undefined,
      paidByUserId: this.paidByUserIdSig()
    };

    if (req.splitType === 'EXACT') {
      req.splits = type === 'EQUAL'
        ? Object.fromEntries(selected.map(id => [id, Math.round(amount / selected.length * 100) / 100]))
        : this.effectiveSplits();
    }

    this.expenseError.set(null);
    this.svc.addExpense(this.selectedGroup()!.id, req).subscribe({
      next: () => {
        this.showAddExpense.set(false);
        this.expenseError.set(null);
        this.selectGroup(this.selectedGroup()!);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Failed to add expense. Please try again.';
        this.expenseError.set(msg);
      }
    });
  }

  // ── Settle ─────────────────────────────────────────────────────────────────
  openSettle(s: PaymentSuggestion): void {
    this.settleTarget.set({ toUserId: s.toUserId, toName: s.toDisplayName, amount: s.amount });
    this.settleForm.reset({ amount: s.amount, notes: '' });
    this.showSettle.set(true);
  }

  openMemberDetail(userId: string): void {
    this.selectedBalanceMember.set(userId);
    this.showMemberDetail.set(true);
  }

  openProfile(): void {
    this.showProfilePanel.set(true);
    this.selectedGroup.set(null);
  }

  deleteExpense(exp: Expense): void {
    if (!this.selectedGroup()) return;
    this.svc.deleteExpense(this.selectedGroup()!.id, exp.id).subscribe(() => {
      this.selectGroup(this.selectedGroup()!);
    });
  }

  deleteGroup(): void {
    const group = this.selectedGroup();
    if (!group) return;
    this.svc.deleteGroup(group.id).subscribe({
      next: () => {
        this.showDeleteGroupConfirm.set(false);
        this.selectedGroup.set(null);
        this.showProfilePanel.set(false);
        this.loadGroups();
      },
      error: () => {
        this.showDeleteGroupConfirm.set(false);
      }
    });
  }

  openManageMembers(): void {
    this.addMemberForm.reset();
    this.memberMgmtError.set(null);
    this.showManageMembers.set(true);
  }

  addMember(): void {
    this.addMemberForm.markAllAsTouched();
    if (this.addMemberForm.invalid || !this.selectedGroup()) return;
    const email = this.addMemberForm.value.email!.trim();
    this.memberMgmtLoading.set(true);
    this.memberMgmtError.set(null);
    this.svc.addGroupMember(this.selectedGroup()!.id, email).subscribe({
      next: () => {
        this.addMemberForm.reset();
        this.memberMgmtLoading.set(false);
        this.selectGroup(this.selectedGroup()!);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Could not add member. Check the email address.';
        this.memberMgmtError.set(msg);
        this.memberMgmtLoading.set(false);
      }
    });
  }

  removeMember(userId: string): void {
    if (!this.selectedGroup()) return;
    this.memberMgmtLoading.set(true);
    this.memberMgmtError.set(null);
    this.svc.removeGroupMember(this.selectedGroup()!.id, userId).subscribe({
      next: () => {
        this.memberMgmtLoading.set(false);
        this.selectGroup(this.selectedGroup()!);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Could not remove member.';
        this.memberMgmtError.set(msg);
        this.memberMgmtLoading.set(false);
      }
    });
  }

  openSettleAndClose(s: PaymentSuggestion | null): void {
    if (!s) return;
    this.openSettle(s);
    this.showMemberDetail.set(false);
  }

  confirmSettle(): void {
    if (this.settleForm.invalid || !this.settleTarget() || !this.selectedGroup()) return;
    const v = this.settleForm.value;
    const t = this.settleTarget()!;
    const req: SettleRequest = {
      groupId: this.selectedGroup()!.id,
      toUserId: t.toUserId,
      amount: v.amount!,
      notes: v.notes ?? ''
    };
    this.svc.settle(req).subscribe(() => {
      this.showSettle.set(false);
      this.selectGroup(this.selectedGroup()!);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  formatCurrency(amount: number, currency = 'USD'): string {
    const syms: Record<string, string> = { NPR: 'रू', INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const sym = syms[currency] ?? currency + ' ';
    const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
    return (amount < 0 ? '-' : '') + sym + n;
  }

  getMemberName(userId: string): string {
    return this.memberMap()[userId]?.displayName ?? userId;
  }

  getMemberInitials(userId: string): string {
    return this.memberMap()[userId]?.initials ?? '?';
  }

  balanceClass(amount: number): string {
    return amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'neutral';
  }

  currentUserId(): string {
    try { return JSON.parse(localStorage.getItem('mantra_user') ?? '{}').userId ?? ''; }
    catch { return ''; }
  }

  currentUserName(): string {
    try {
      const u = JSON.parse(localStorage.getItem('mantra_user') ?? '{}');
      return u.displayName ?? u.name ?? u.email ?? 'Me';
    } catch { return 'Me'; }
  }

  currentUserInitials(): string {
    const name = this.currentUserName();
    return name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || 'ME';
  }

  getPersonInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
  }

  readonly CATEGORIES = [
    { value: 'TRIP',  label: '✈️ Trip'  },
    { value: 'HOME',  label: '🏠 Home'  },
    { value: 'FOOD',  label: '🍔 Food'  },
    { value: 'WORK',  label: '💼 Work'  },
    { value: 'OTHER', label: '📦 Other' }
  ];

  private updateFlowPaths(): void {
    if (!this.selectedGroup()) {
      this.flowPath1.set('');
      this.flowPath2.set('');
      return;
    }
    const svg     = document.querySelector<SVGSVGElement>('.flow-connector-svg');
    const source  = document.getElementById('flow-source-card');
    const target1 = document.getElementById('flow-target-balances');
    const target2 = document.getElementById('flow-target-expenses');
    if (!svg || !source || !target1 || !target2) {
      this.flowPath1.set('');
      this.flowPath2.set('');
      return;
    }
    const svgRect = svg.getBoundingClientRect();
    const srcRect = source.getBoundingClientRect();
    const t1Rect  = target1.getBoundingClientRect();
    const t2Rect  = target2.getBoundingClientRect();
    const sx  = srcRect.right  - svgRect.left;
    const sy  = srcRect.top + srcRect.height / 2 - svgRect.top;
    const t1x = t1Rect.left    - svgRect.left;
    const t1y = t1Rect.top + t1Rect.height / 2 - svgRect.top;
    const t2x = t2Rect.left    - svgRect.left;
    const t2y = t2Rect.top + t2Rect.height / 2 - svgRect.top;
    const cx  = (sx + t1x) / 2;
    const newPath1 = `M${sx},${sy} C${cx},${sy} ${cx},${t1y} ${t1x},${t1y}`;
    const newPath2 = `M${sx},${sy} C${cx},${sy} ${cx},${t2y} ${t2x},${t2y}`;
    if (this.flowPath1() !== newPath1) this.flowPath1.set(newPath1);
    if (this.flowPath2() !== newPath2) this.flowPath2.set(newPath2);
    const d1 = this.flowDot1();
    if (d1.x !== t1x || d1.y !== t1y) this.flowDot1.set({ x: t1x, y: t1y });
    const d2 = this.flowDot2();
    if (d2.x !== t2x || d2.y !== t2y) this.flowDot2.set({ x: t2x, y: t2y });
  }
}
