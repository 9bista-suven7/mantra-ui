import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  effect,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MessageDto, SendMessageRequest } from '../../../models/chat.model';
import { BalanceSummary } from '../../../models/expense.model';
import { ChatService } from '../../../core/services/chat.service';
import { GroupService } from '../../../core/services/group.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatTarget } from '../chat.component';
import { Subscription } from 'rxjs';
import { MessageListComponent } from '../message-list/message-list.component';
import { MessageInputComponent } from '../message-input/message-input.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, RouterLink, MessageListComponent, MessageInputComponent],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  readonly target = input.required<ChatTarget>();

  /** Emitted when the user clicks the header delete/leave button. */
  readonly deleteRequested = output<ChatTarget>();

  private readonly chatService = inject(ChatService);
  private readonly groupService = inject(GroupService);
  private readonly expenseService = inject(ExpenseService);
  private readonly ws = inject(WebSocketService);
  private readonly auth = inject(AuthService);

  readonly messages = signal<MessageDto[]>([]);
  readonly loading = signal(false);
  readonly hasMore = signal(true);
  readonly typingUsers = signal<string[]>([]);
  readonly sending = signal(false);
  readonly balances = signal<BalanceSummary | null>(null);
  readonly showInfo = signal(false);

  readonly currentUserId = computed(() => this.auth.currentUser()?.userId ?? '');

  readonly headerName = computed(() => {
    const t = this.target();
    return t.kind === 'conversation' ? t.data.otherUser.displayName : t.data.name;
  });

  readonly headerSub = computed(() => {
    const t = this.target();
    if (t.kind === 'group') return `${t.data.members.length} members`;
    return t.data.otherUserOnline ? 'Online' : 'Offline';
  });

  readonly headerOnline = computed(() => {
    const t = this.target();
    return t.kind === 'conversation' && t.data.otherUserOnline;
  });

  private readonly subs = new Subscription();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    // Reload messages whenever target changes.
    // untracked() prevents loading/messages signal writes inside loadMessages()
    // from being tracked by the effect, which would cause an infinite re-run loop.
    effect(() => {
      const t = this.target();
      untracked(() => {
        this.messages.set([]);
        this.hasMore.set(true);
        this.loadMessages();
        this.loadBalances();
      });
    });
  }

  ngOnInit(): void {
    // Inbound messages from WebSocket
    this.subs.add(
      this.ws.newMessage$.subscribe(msg => {
        const t = this.target();
        const targetId = t.data.id;
        if (msg.conversationId === targetId || msg.groupId === targetId) {
          this.messages.update(list => {
            // Dedup: sender already added their message via the HTTP response
            if (list.some(m => m.id === msg.id)) return list;
            // Append and keep sorted oldest-first by createdAt
            return [...list, msg].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          this.markRead();
        }
      })
    );

    // Typing indicator
    this.subs.add(
      this.ws.typing$.subscribe(ev => {
        const t = this.target();
        const myId = this.currentUserId();
        if (ev.userId === myId) return;
        if (ev.targetId !== t.data.id) return;
        if (ev.typing) {
          this.typingUsers.update(u => u.includes(ev.displayName) ? u : [...u, ev.displayName]);
          const key = ev.userId;
          clearTimeout(this.typingTimers.get(key));
          this.typingTimers.set(key, setTimeout(() => {
            this.typingUsers.update(u => u.filter(n => n !== ev.displayName));
          }, 4000));
        } else {
          this.typingUsers.update(u => u.filter(n => n !== ev.displayName));
        }
      })
    );

    // Presence updates
    this.subs.add(
      this.ws.presence$.subscribe(ev => {
        // Could update header online status here if needed
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.typingTimers.forEach(t => clearTimeout(t));
  }

  loadMessages(before?: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    const t = this.target();
    const obs = t.kind === 'conversation'
      ? this.chatService.getMessages(t.data.id, before)
      : this.groupService.getMessages(t.data.id, before);

    obs.subscribe({
      next: msgs => {
        // Server returns newest-first (DESC); reverse to oldest-first for display
        const asc = [...msgs].reverse();
        if (before) {
          this.messages.update(list => [...asc, ...list]);
        } else {
          this.messages.set(asc);
          this.markRead();
        }
        this.hasMore.set(msgs.length >= 30);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadMore(): void {
    const msgs = this.messages();
    if (msgs.length === 0) return;
    this.loadMessages(msgs[0].createdAt);
  }

  loadBalances(): void {
    const t = this.target();
    const linkedId = t.kind === 'group' ? t.linkedExpenseGroupId : undefined;
    if (!linkedId) {
      this.balances.set(null);
      return;
    }
    this.expenseService.getGroupBalances(linkedId).subscribe({
      next: resp => this.balances.set(resp?.data ?? null),
      error: () => this.balances.set(null)
    });
  }

  sendMessage(req: SendMessageRequest): void {
    const t = this.target();
    this.sending.set(true);
    const obs = t.kind === 'conversation'
      ? this.chatService.sendMessage(t.data.id, { ...req, conversationId: t.data.id })
      : this.groupService.sendMessage(t.data.id, { ...req, groupId: t.data.id });

    obs.subscribe({
      next: msg => {
        this.messages.update(list => [...list, msg]);
        this.sending.set(false);
      },
      error: () => this.sending.set(false)
    });
  }

  private markRead(): void {
    const t = this.target();
    const obs = t.kind === 'conversation'
      ? this.chatService.markRead(t.data.id)
      : this.groupService.markRead(t.data.id);
    // Swallow errors silently — markRead is best-effort and should never
    // propagate a 401/network error to the console as an unhandled exception.
    obs.subscribe({ error: () => {} });
    this.ws.markRead(t.data.id, t.kind === 'group');
  }

  onTypingStart(): void {
    this.ws.sendTypingStart(this.target().data.id);
  }

  onTypingStop(): void {
    this.ws.sendTypingStop(this.target().data.id);
  }

  toggleInfo(): void { this.showInfo.update(v => !v); }
  closeInfo(): void { this.showInfo.set(false); }

  /** Emit a delete request for the current target up to the parent. */
  requestDelete(): void {
    this.deleteRequested.emit(this.target());
  }

  /** Format ISO timestamp for the info panel. */
  formatJoinedDate(iso?: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  }
}
