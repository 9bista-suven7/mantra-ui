import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../core/services/websocket.service';
import { ChatService } from '../../core/services/chat.service';
import { GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';
import { ConversationDto, GroupDto } from '../../models/chat.model';
import { ExpenseGroup } from '../../models/expense.model';

import { Subscription } from 'rxjs';
import { ChatSidebarComponent } from './chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';

export type ChatTarget =
  | { kind: 'conversation'; data: ConversationDto }
  | { kind: 'group'; data: GroupDto; linkedExpenseGroupId?: string };

// Unsplash nature/cozy/abstract images that work well as chat backgrounds
const BG_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80', // mountain sunrise
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600&q=80', // galaxy night
  'https://images.unsplash.com/photo-1520962922320-2038eebab146?w=1600&q=80', // northern lights
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1600&q=80', // wildflowers
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80', // green hills
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&q=80', // foggy forest
];
const ROTATE_INTERVAL_MS = 120_000; // 2 minutes

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatSidebarComponent, ChatWindowComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy {

  private readonly ws = inject(WebSocketService);
  private readonly chatService = inject(ChatService);
  private readonly groupService = inject(GroupService);
  private readonly auth = inject(AuthService);

  readonly conversations = signal<ConversationDto[]>([]);
  readonly groups = signal<GroupDto[]>([]);
  readonly selectedTarget = signal<ChatTarget | null>(null);
  readonly loading = signal(true);

  /**
   * Chat-group IDs whose `linkedExpenseGroupId` is set — these are owned by
   * a Splitwise expense group and must appear under "Splitwise Groups" only,
   * never under "My Groups". Derived directly from server data so every account
   * sees the same view.
   */
  readonly linkedChatGroupIds = computed(() =>
    this.groups().filter(g => !!g.linkedExpenseGroupId).map(g => g.id)
  );

  /** In-app confirm dialog state (replaces native confirm()). */
  readonly confirmDialog = signal<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Background slideshow
  readonly bgIndex = signal(0);
  readonly bgFade = signal(true);
  readonly bgImages = BG_IMAGES;
  private bgTimer: ReturnType<typeof setInterval> | null = null;

  private readonly subs = new Subscription();

  ngOnInit(): void {
    this.ws.connect();
    this.loadData();
    this.startSlideshow();

    // Update unread badges when new messages arrive
    this.subs.add(
      this.ws.newMessage$.subscribe(msg => {
        if (msg.conversationId) {
          this.conversations.update(list =>
            list.map(c => c.id === msg.conversationId && this.selectedTarget()?.data?.id !== c.id
              ? { ...c, unreadCount: c.unreadCount + 1, lastMessage: { content: msg.content ?? '', senderId: msg.senderId, type: msg.type, sentAt: msg.createdAt } }
              : c.id === msg.conversationId
                ? { ...c, lastMessage: { content: msg.content ?? '', senderId: msg.senderId, type: msg.type, sentAt: msg.createdAt } }
                : c
            )
          );
        } else if (msg.groupId) {
          this.groups.update(list =>
            list.map(g => g.id === msg.groupId && this.selectedTarget()?.data?.id !== g.id
              ? { ...g, unreadCount: g.unreadCount + 1, lastMessage: { content: msg.content ?? '', senderId: msg.senderId, type: msg.type, sentAt: msg.createdAt } }
              : g.id === msg.groupId
                ? { ...g, lastMessage: { content: msg.content ?? '', senderId: msg.senderId, type: msg.type, sentAt: msg.createdAt } }
                : g
            )
          );
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.bgTimer) clearInterval(this.bgTimer);
  }

  private startSlideshow(): void {
    this.bgTimer = setInterval(() => {
      this.bgFade.set(false);
      setTimeout(() => {
        this.bgIndex.update(i => (i + 1) % BG_IMAGES.length);
        this.bgFade.set(true);
      }, 500);
    }, ROTATE_INTERVAL_MS);
  }

  private loadData(): void {
    this.chatService.listConversations().subscribe(list => {
      this.conversations.set(list);
      this.loading.set(false);
    });
    this.groupService.listGroups().subscribe(list => this.groups.set(list));
  }

  selectConversation(conv: ConversationDto): void {
    this.selectedTarget.set({ kind: 'conversation', data: conv });
    this.conversations.update(list => list.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
  }

  selectGroup(group: GroupDto): void {
    this.selectedTarget.set({
      kind: 'group',
      data: group,
      linkedExpenseGroupId: group.linkedExpenseGroupId,
    });
    this.groups.update(list => list.map(g => g.id === group.id ? { ...g, unreadCount: 0 } : g));
  }

  onExpenseGroupSelected(eg: ExpenseGroup): void {
    // If a chat group is already loaded for this expense group, reuse it.
    const existing = this.groups().find(g => g.linkedExpenseGroupId === eg.id);
    if (existing) {
      this.selectedTarget.set({ kind: 'group', data: existing, linkedExpenseGroupId: eg.id });
      this.groups.update(list => list.map(g => g.id === existing.id ? { ...g, unreadCount: 0 } : g));
      return;
    }

    // Otherwise ask the server to find-or-create one tied to this expense group.
    // The backend de-duplicates via Group.linkedExpenseGroupId, so every account
    // ends up with the same chat group.
    const myId = this.auth.currentUser()?.userId;
    const memberIds = eg.memberIds.filter(id => id && id !== myId);

    this.groupService.createGroup({
      name: eg.name,
      description: eg.description ?? `Splitwise: ${eg.name}`,
      memberIds,
      linkedExpenseGroupId: eg.id,
    }).subscribe(group => {
      this.groups.update(list => list.some(g => g.id === group.id)
        ? list.map(g => g.id === group.id ? group : g)
        : [group, ...list]);
      this.selectedTarget.set({ kind: 'group', data: group, linkedExpenseGroupId: eg.id });
    });
  }

  /** Hide a 1-to-1 conversation for the current user. */
  onDeleteConversation(conv: ConversationDto): void {
    this.confirmDialog.set({
      title: 'Remove chat?',
      message: `Remove your chat with ${conv.otherUser.displayName}? It will reappear if they message you again.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: () => {
        this.chatService.hideConversation(conv.id).subscribe(() => {
          this.conversations.update(list => list.filter(c => c.id !== conv.id));
          if (this.selectedTarget()?.data?.id === conv.id) this.selectedTarget.set(null);
        });
      },
    });
  }

  /** Leave a group for the current user. */
  onDeleteGroup(group: GroupDto): void {
    this.confirmDialog.set({
      title: 'Leave group?',
      message: `Leave “${group.name}”? You won’t see new messages unless you’re added back.`,
      confirmLabel: 'Leave',
      danger: true,
      onConfirm: () => {
        this.groupService.leaveGroup(group.id).subscribe(() => {
          this.groups.update(list => list.filter(g => g.id !== group.id));
          if (this.selectedTarget()?.data?.id === group.id) this.selectedTarget.set(null);
        });
      },
    });
  }

  /** Called by the dialog template. */
  confirmDialogConfirm(): void {
    const d = this.confirmDialog();
    if (!d) return;
    d.onConfirm();
    this.confirmDialog.set(null);
  }
  confirmDialogCancel(): void { this.confirmDialog.set(null); }

  /** Header delete button on the chat window — dispatch to the right handler. */
  onWindowDeleteRequested(target: ChatTarget): void {
    if (target.kind === 'conversation') {
      this.onDeleteConversation(target.data);
    } else {
      this.onDeleteGroup(target.data);
    }
  }

  onConversationReady(conv: ConversationDto): void {
    this.conversations.update(list =>
      list.some(c => c.id === conv.id) ? list : [conv, ...list]
    );
    this.selectConversation(conv);
  }

  onGroupReady(group: GroupDto): void {
    this.groups.update(list =>
      list.some(g => g.id === group.id) ? list : [group, ...list]
    );
    this.selectGroup(group);
  }
}
