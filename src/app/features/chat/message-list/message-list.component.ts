import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageDto } from '../../../models/chat.model';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message-list.component.html',
  styleUrl: './message-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageListComponent implements AfterViewChecked, OnChanges {
  readonly messages = input<MessageDto[]>([]);
  readonly currentUserId = input<string>('');
  readonly loading = input(false);
  readonly hasMore = input(false);

  readonly loadMore = output<void>();

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLElement>;

  private shouldScrollToBottom = true;
  private prevMessageCount = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      const newCount = this.messages().length;
      const prevCount = this.prevMessageCount;
      // Scroll to bottom on initial load OR when new messages arrive at the end
      this.shouldScrollToBottom = newCount > prevCount && (prevCount === 0 || true);
      // But NOT when prepending older messages (load-more): handled by prevCount check
      if (prevCount !== 0 && newCount > prevCount) {
        // Only auto-scroll if adding to end, not prepending
        const firstIdBefore = (changes['messages'].previousValue as MessageDto[])?.[0]?.id;
        const firstIdNow = this.messages()[0]?.id;
        this.shouldScrollToBottom = firstIdBefore === firstIdNow || prevCount === 0;
      }
      this.prevMessageCount = newCount;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop < 80 && this.hasMore() && !this.loading()) {
      this.loadMore.emit();
    }
  }

  isOwn(msg: MessageDto): boolean {
    return msg.senderId === this.currentUserId();
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Returns true if the message above has a different date (for date dividers). */
  showDateDivider(msgs: MessageDto[], index: number): boolean {
    if (index === 0) return true;
    const cur = new Date(msgs[index].createdAt).toDateString();
    const prev = new Date(msgs[index - 1].createdAt).toDateString();
    return cur !== prev;
  }

  statusIcon(msg: MessageDto): string {
    switch (msg.status) {
      case 'SENDING': return 'schedule';
      case 'SENT': return 'done';
      case 'DELIVERED': return 'done_all';
      case 'READ': return 'done_all';
      case 'FAILED': return 'error_outline';
      default: return 'done';
    }
  }

  isAudio(att: { contentType?: string; originalName?: string }): boolean {
    if (att.contentType?.startsWith('audio/')) return true;
    const name = (att.originalName ?? '').toLowerCase();
    return /\.(mp3|wav|ogg|m4a|webm|aac|flac)$/.test(name);
  }
}
