import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  output,
  signal,
  computed,
  inject,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { ConversationDto, GroupDto, UserSearchResult } from '../../../models/chat.model';
import { ExpenseGroup } from '../../../models/expense.model';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ChatService } from '../../../core/services/chat.service';
import { GroupService } from '../../../core/services/group.service';
import { ExpenseService } from '../../../core/services/expense.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatSidebarComponent implements OnDestroy {

  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly conversations = input<ConversationDto[]>([]);
  readonly groups = input<GroupDto[]>([]);
  readonly selectedId = input<string | null>(null);  /** Chat-group IDs that are linked to a Splitwise expense group — these are
   *  shown only under "Splitwise Groups" and excluded from "My Groups" so
   *  they don't appear duplicated when a message is sent. */
  readonly linkedGroupIds = input<string[]>([]);
  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly conversationSelected = output<ConversationDto>();
  readonly groupSelected = output<GroupDto>();
  /** Fired when a new DM conversation is created/opened. */
  readonly conversationReady = output<ConversationDto>();
  /** Fired when a new group is created. */
  readonly groupReady = output<GroupDto>();
  /** Fired when a Splitwise group is selected — chat opens for that expense group. */
  readonly expenseGroupSelected = output<ExpenseGroup>();  /** Fired when the user clicks the delete/remove icon on a direct chat. */
  readonly conversationDeleteRequested = output<ConversationDto>();
  /** Fired when the user clicks the delete/leave icon on a group chat. */
  readonly groupDeleteRequested = output<GroupDto>();
  // ── Injections ────────────────────────────────────────────────────────────
  readonly wsConnected$ = inject(WebSocketService).connected$;
  readonly auth = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly groupService = inject(GroupService);
  private readonly expenseService = inject(ExpenseService);

  // ── Sidebar state ─────────────────────────────────────────────────────────
  readonly searchQuery = signal('');
  readonly activeTab = signal<'direct' | 'groups'>('direct');

  readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.conversations().filter(c =>
      c.otherUser.displayName.toLowerCase().includes(q) ||
      c.otherUser.email.toLowerCase().includes(q)
    );
  });

  readonly filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const linked = new Set(this.linkedGroupIds());
    return this.groups().filter(g =>
      !linked.has(g.id) && g.name.toLowerCase().includes(q)
    );
  });

  // ── Splitwise (expense) groups ────────────────────────────────────────────
  readonly expenseGroups = signal<ExpenseGroup[]>([]);
  readonly loadingExpenseGroups = signal(false);
  readonly filteredExpenseGroups = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.expenseGroups().filter(g => g.name.toLowerCase().includes(q));
  });

  /**
   * Tab badge count for "Groups" — my groups (excluding ones linked to a
   * Splitwise expense group, which are shown only under "Splitwise Groups")
   * plus any loaded Splitwise expense groups.
   */
  readonly groupsTabCount = computed(() => {
    const linked = new Set(this.linkedGroupIds());
    const myCount = this.groups().filter(g => !linked.has(g.id)).length;
    return myCount + this.expenseGroups().length;
  });

  readonly totalUnread = computed(() => {
    const linked = new Set(this.linkedGroupIds());
    return (
      this.conversations().reduce((sum, c) => sum + c.unreadCount, 0) +
      this.groups().reduce((sum, g) => sum + (linked.has(g.id) ? 0 : g.unreadCount), 0)
    );
  });

  // ── New DM modal ──────────────────────────────────────────────────────────
  readonly showActionMenu = signal(false);
  readonly showNewDm = signal(false);
  readonly dmQuery = signal('');
  readonly dmResults = signal<UserSearchResult[]>([]);
  readonly dmSearching = signal(false);
  readonly dmStarting = signal(false);

  // ── New Group modal ───────────────────────────────────────────────────────
  readonly showNewGroup = signal(false);
  readonly groupName = signal('');
  readonly groupQuery = signal('');
  readonly groupSearchResults = signal<UserSearchResult[]>([]);
  readonly groupSearching = signal(false);
  readonly selectedMembers = signal<UserSearchResult[]>([]);
  readonly creatingGroup = signal(false);

  // ── RxJS streams ─────────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();
  private readonly dmSearch$ = new Subject<string>();
  private readonly groupSearch$ = new Subject<string>();

  constructor() {
    this.dmSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2 ? this.chatService.searchUsers(q) : of([])),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.dmResults.set(results);
      this.dmSearching.set(false);
    });

    this.groupSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2 ? this.chatService.searchUsers(q) : of([])),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.groupSearchResults.set(results);
      this.groupSearching.set(false);
    });

    // Eagerly load Splitwise expense groups so the Groups tab badge reflects
    // the full total (My Groups + Splitwise) on initial load, not only after
    // the user opens the Groups tab.
    this.loadExpenseGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Sidebar actions ───────────────────────────────────────────────────────
  setTab(tab: 'direct' | 'groups'): void {
    this.activeTab.set(tab);
    if (tab === 'groups' && this.expenseGroups().length === 0 && !this.loadingExpenseGroups()) {
      this.loadExpenseGroups();
    }
  }
  selectConversation(conv: ConversationDto): void { this.conversationSelected.emit(conv); }
  selectGroup(group: GroupDto): void { this.groupSelected.emit(group); }
  selectExpenseGroup(eg: ExpenseGroup): void { this.expenseGroupSelected.emit(eg); }

  /** Unread count of the chat group linked to a given Splitwise expense group. */
  expenseGroupUnread(eg: ExpenseGroup): number {
    const linked = this.groups().find(g => g.linkedExpenseGroupId === eg.id);
    return linked?.unreadCount ?? 0;
  }

  requestDeleteConversation(conv: ConversationDto, ev: Event): void {
    ev.stopPropagation();
    this.conversationDeleteRequested.emit(conv);
  }
  requestDeleteGroup(group: GroupDto, ev: Event): void {
    ev.stopPropagation();
    this.groupDeleteRequested.emit(group);
  }

  loadExpenseGroups(): void {
    this.loadingExpenseGroups.set(true);
    this.expenseService.getGroups().subscribe({
      next: list => {
        this.expenseGroups.set(list ?? []);
        this.loadingExpenseGroups.set(false);
      },
      error: () => {
        this.expenseGroups.set([]);
        this.loadingExpenseGroups.set(false);
      }
    });
  }

  toggleActionMenu(): void { this.showActionMenu.update(v => !v); }

  @HostListener('document:click')
  closeActionMenu(): void { this.showActionMenu.set(false); }

  // ── New DM ────────────────────────────────────────────────────────────────
  openNewDm(): void {
    this.dmQuery.set('');
    this.dmResults.set([]);
    this.dmSearching.set(false);
    this.showNewDm.set(true);
  }

  onDmQueryChange(q: string): void {
    this.dmQuery.set(q);
    if (q.length >= 2) this.dmSearching.set(true);
    else this.dmResults.set([]);
    this.dmSearch$.next(q);
  }

  startDm(user: UserSearchResult): void {
    this.dmStarting.set(true);
    this.chatService.getOrCreateConversation(user.id).subscribe(conv => {
      this.conversationReady.emit(conv);
      this.showNewDm.set(false);
      this.dmStarting.set(false);
    });
  }

  // ── New Group ─────────────────────────────────────────────────────────────
  openNewGroup(): void {
    this.groupName.set('');
    this.groupQuery.set('');
    this.groupSearchResults.set([]);
    this.selectedMembers.set([]);
    this.showNewGroup.set(true);
  }

  onGroupQueryChange(q: string): void {
    this.groupQuery.set(q);
    if (q.length >= 2) this.groupSearching.set(true);
    else this.groupSearchResults.set([]);
    this.groupSearch$.next(q);
  }

  toggleMember(user: UserSearchResult): void {
    const cur = this.selectedMembers();
    const idx = cur.findIndex(u => u.id === user.id);
    this.selectedMembers.set(idx >= 0 ? cur.filter(u => u.id !== user.id) : [...cur, user]);
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMembers().some(u => u.id === userId);
  }

  createGroup(): void {
    if (!this.groupName().trim() || this.selectedMembers().length === 0) return;
    this.creatingGroup.set(true);
    this.groupService.createGroup({
      name: this.groupName().trim(),
      memberIds: this.selectedMembers().map(u => u.id)
    }).subscribe(group => {
      this.groupReady.emit(group);
      this.showNewGroup.set(false);
      this.creatingGroup.set(false);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  avatarInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}

