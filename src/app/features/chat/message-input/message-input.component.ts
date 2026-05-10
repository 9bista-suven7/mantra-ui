import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  ViewChild,
  ElementRef,
  inject,
  HostListener,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SendMessageRequest } from '../../../models/chat.model';
import { ChatService } from '../../../core/services/chat.service';

interface EmojiCategory { name: string; emojis: string[]; }

const EMOJI_CATEGORIES: EmojiCategory[] = [
  { name: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😪','🤤','😴','🥱'] },
  { name: 'Gestures', emojis: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','👏','🙌','💪','🦾'] },
  { name: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'] },
  { name: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦄','🐝','🐞','🦋'] },
  { name: 'Food', emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥕','🌽','🌶️','🥒','🥬','🍕','🍔','🍟','🌭','🥪','🌮','🍿','🍩','🍪','🍰','🎂','🍫','🍦','🍵','☕','🍺','🍷'] },
  { name: 'Activity', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','⛳','🎯','🎮','🎲','🧩','🎨','🎭','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻'] },
  { name: 'Travel', emojis: ['✈️','🚀','🛸','🚁','🛶','⛵','🛥️','🚤','🛳️','⛴️','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚊','🚉','🚞','🚝','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🚲'] },
  { name: 'Objects', emojis: ['💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷','💰','💳','🧾','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪'] },
  { name: 'Symbols', emojis: ['✅','❌','⭐','🌟','✨','⚡','🔥','💯','💢','💥','💫','💦','💨','🕳️','🎵','🎶','🔔','🔕','📢','📣','📯','♻️','🆔','🆗','🆕','🆒','🆓','🆖','🆙','🔚','🔛','🔜','🔝','🔙'] },
];

const PRESET_GIFS: { label: string; url: string }[] = [
  { label: 'LOL',     url: 'https://media.giphy.com/media/ZcKASxMYMKA9SQnhIl/giphy.gif' },
  { label: 'Wave',    url: 'https://media.giphy.com/media/Lp9dEX1ZUmOaAosw02/giphy.gif' },
  { label: 'Love',    url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif' },
  { label: 'Party',   url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
  { label: 'Sad',     url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif' },
  { label: 'Wow',     url: 'https://media.giphy.com/media/3o7TKr2eYXbZBBwGz6/giphy.gif' },
  { label: 'Clap',    url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif' },
  { label: 'Thumbs',  url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { label: 'Dance',   url: 'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif' },
  { label: 'Sleep',   url: 'https://media.giphy.com/media/iJCkVfOaYngykSU0WW/giphy.gif' },
  { label: 'Cool',    url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif' },
  { label: 'Cry',     url: 'https://media.giphy.com/media/L95W4wv8nnb9K/giphy.gif' },
];

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageInputComponent implements OnDestroy {
  readonly sending = input(false);

  readonly messageSent = output<SendMessageRequest>();
  readonly typingStart = output<void>();
  readonly typingStop = output<void>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('textInput') textInputRef!: ElementRef<HTMLTextAreaElement>;

  private readonly chatService = inject(ChatService);

  readonly text = signal('');
  readonly uploading = signal(false);

  // Pickers
  readonly showEmoji = signal(false);
  readonly showGif = signal(false);
  readonly emojiCategories = EMOJI_CATEGORIES;
  readonly activeEmojiCat = signal(0);
  readonly presetGifs = PRESET_GIFS;
  readonly gifUrl = signal('');

  // Audio recording
  readonly recording = signal(false);
  readonly recordSeconds = signal(0);
  private mediaRecorder: MediaRecorder | null = null;
  private mediaChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private recordTimer: ReturnType<typeof setInterval> | null = null;

  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isTyping = false;

  ngOnDestroy(): void {
    this.stopTyping();
    this.cleanupRecording();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    if (!target.closest('.picker-host')) {
      this.showEmoji.set(false);
      this.showGif.set(false);
    }
  }

  // ── Text handling ─────────────────────────────────────────
  onInput(value: string): void {
    this.text.set(value);
    if (!this.isTyping) {
      this.isTyping = true;
      this.typingStart.emit();
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.typingStop.emit();
    }, 2000);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const content = this.text().trim();
    if (!content || this.sending() || this.uploading()) return;
    this.messageSent.emit({ type: 'TEXT', content });
    this.text.set('');
    this.stopTyping();
  }

  // ── Files (existing) ──────────────────────────────────────
  openFilePicker(): void { this.fileInputRef.nativeElement.click(); }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadAndSend(file);
    input.value = '';
  }

  private uploadAndSend(file: File): void {
    this.uploading.set(true);
    this.chatService.uploadFile(file).subscribe({
      next: resp => {
        const type: 'IMAGE' | 'FILE' = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
        this.messageSent.emit({ type, fileId: resp.fileId, content: file.name });
        this.uploading.set(false);
      },
      error: () => this.uploading.set(false)
    });
  }

  // ── Emoji picker ──────────────────────────────────────────
  toggleEmoji(): void {
    this.showGif.set(false);
    this.showEmoji.update(v => !v);
  }
  setEmojiCat(i: number): void { this.activeEmojiCat.set(i); }

  insertEmoji(e: string): void {
    const ta = this.textInputRef?.nativeElement;
    if (ta && document.activeElement === ta) {
      const start = ta.selectionStart ?? this.text().length;
      const end = ta.selectionEnd ?? start;
      const v = this.text();
      const next = v.slice(0, start) + e + v.slice(end);
      this.text.set(next);
      // Restore cursor after the inserted emoji
      queueMicrotask(() => {
        ta.focus();
        const pos = start + e.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      this.text.update(v => v + e);
    }
  }

  // ── GIF picker ────────────────────────────────────────────
  toggleGif(): void {
    this.showEmoji.set(false);
    this.showGif.update(v => !v);
  }

  pickGif(url: string): void {
    if (!url || this.uploading()) return;
    this.uploading.set(true);
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('GIF fetch failed');
        return r.blob();
      })
      .then(blob => {
        const name = `gif-${Date.now()}.gif`;
        const file = new File([blob], name, { type: blob.type || 'image/gif' });
        this.chatService.uploadFile(file).subscribe({
          next: resp => {
            this.messageSent.emit({ type: 'IMAGE', fileId: resp.fileId, content: 'GIF' });
            this.uploading.set(false);
            this.showGif.set(false);
            this.gifUrl.set('');
          },
          error: () => this.uploading.set(false)
        });
      })
      .catch(() => this.uploading.set(false));
  }

  sendGifFromUrl(): void {
    const url = this.gifUrl().trim();
    if (url) this.pickGif(url);
  }

  // ── Audio recording ───────────────────────────────────────
  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = this.pickAudioMime();
      this.mediaRecorder = mime ? new MediaRecorder(this.mediaStream, { mimeType: mime })
                                : new MediaRecorder(this.mediaStream);
      this.mediaChunks = [];
      this.mediaRecorder.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) this.mediaChunks.push(ev.data);
      };
      this.mediaRecorder.onstop = () => this.finalizeRecording();
      this.mediaRecorder.start();
      this.recording.set(true);
      this.recordSeconds.set(0);
      this.recordTimer = setInterval(() => this.recordSeconds.update(s => s + 1), 1000);
    } catch {
      this.cleanupRecording();
    }
  }

  private stopRecording(): void {
    try { this.mediaRecorder?.stop(); } catch { /* ignore */ }
    if (this.recordTimer) { clearInterval(this.recordTimer); this.recordTimer = null; }
    this.recording.set(false);
  }

  cancelRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.onstop = null as any;
      try { this.mediaRecorder.stop(); } catch { /* ignore */ }
    }
    this.cleanupRecording();
  }

  private finalizeRecording(): void {
    const chunks = this.mediaChunks;
    const mime = this.mediaRecorder?.mimeType || 'audio/webm';
    this.cleanupRecording();
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mime });
    const ext = mime.includes('mp4') ? 'm4a' : (mime.includes('ogg') ? 'ogg' : 'webm');
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
    this.uploadAndSend(file);
  }

  private cleanupRecording(): void {
    if (this.recordTimer) { clearInterval(this.recordTimer); this.recordTimer = null; }
    this.recording.set(false);
    this.recordSeconds.set(0);
    this.mediaChunks = [];
    this.mediaRecorder = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  private pickAudioMime(): string | null {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return null;
  }

  formatRecordTime(): string {
    const s = this.recordSeconds();
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  private stopTyping(): void {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.isTyping) {
      this.isTyping = false;
      this.typingStop.emit();
    }
  }
}
