import {
  ChangeDetectionStrategy, Component, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Note, NoteRequest } from '../../models/note.model';
import { NoteService } from '../../core/services/note.service';

/** Bright pastel sticky-note colours. */
const STICKY_COLORS = [
  '#fef08a', // yellow
  '#fda4af', // rose
  '#93c5fd', // blue
  '#86efac', // green
  '#c4b5fd', // violet
  '#fdba74', // orange
  '#67e8f9', // cyan
  '#bef264', // lime
];

const POSITIONS_KEY = 'mantra_note_positions';

interface NotePos { x: number; y: number; rotation: number; }

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesComponent implements OnInit {

  private readonly svc = inject(NoteService);
  private readonly fb  = inject(FormBuilder);

  readonly notes      = signal<Note[]>([]);
  readonly loading    = signal(false);
  readonly showForm   = signal(false);
  readonly editId     = signal<string | null>(null);
  readonly draggingId = signal<string | null>(null);
  readonly positions  = signal<Record<string, NotePos>>({});
  readonly colors     = STICKY_COLORS;

  /** Tracks mouse start point and note start position during drag. */
  private dragStartX  = 0;
  private dragStartY  = 0;
  private noteStartX  = 0;
  private noteStartY  = 0;

  readonly form = this.fb.group({
    title:   ['', Validators.required],
    content: [''],
    tags:    [''],
    color:   [STICKY_COLORS[0]]
  });

  ngOnInit(): void {
    this.loadPositions();
    this.load();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: notes => {
        this.notes.set(notes);
        this.autoArrangeNew(notes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openForm(note?: Note): void {
    if (note) {
      this.editId.set(note.id);
      this.form.patchValue({
        title:   note.title,
        content: note.content ?? '',
        tags:    note.tags?.join(', ') ?? '',
        color:   note.color
      });
    } else {
      this.editId.set(null);
      this.form.reset({ color: STICKY_COLORS[0] });
    }
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    const req: NoteRequest = {
      title:   v.title!,
      content: v.content ?? '',
      tags:    v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      color:   v.color ?? STICKY_COLORS[0]
    };
    const op = this.editId()
      ? this.svc.update(this.editId()!, req)
      : this.svc.create(req);
    op.subscribe(() => { this.showForm.set(false); this.load(); });
  }

  togglePin(id: string): void {
    this.svc.togglePin(id).subscribe(() => this.load());
  }

  delete(id: string): void {
    this.positions.update(p => { const c = { ...p }; delete c[id]; return c; });
    this.savePositions();
    this.svc.delete(id).subscribe(() => this.load());
  }

  setColor(c: string): void { this.form.patchValue({ color: c }); }

  // ── Drag ──────────────────────────────────────────────────────────────────

  startDrag(event: MouseEvent, noteId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.draggingId.set(noteId);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    const pos = this.notePos(noteId);
    this.noteStartX = pos.x;
    this.noteStartY = pos.y;

    const onMove = (e: MouseEvent) => {
      const x = Math.max(0, this.noteStartX + (e.clientX - this.dragStartX));
      const y = Math.max(0, this.noteStartY + (e.clientY - this.dragStartY));
      this.positions.update(p => ({ ...p, [noteId]: { ...p[noteId], x, y } }));
    };

    const onUp = () => {
      this.draggingId.set(null);
      this.savePositions();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  notePos(id: string): NotePos {
    return this.positions()[id] ?? { x: 40, y: 40, rotation: 0 };
  }

  /**
   * Returns an inline transform string.
   * While dragging: tilt + lift effect.
   * Otherwise: gentle random rotation stored per note.
   */
  noteTransform(id: string): string {
    if (this.draggingId() === id) return 'rotate(3deg) scale(1.06)';
    return `rotate(${this.notePos(id).rotation}deg)`;
  }

  /**
   * Returns a legible text color (dark/light) based on background luminance.
   * Handles both the original dark palette and the new pastel palette.
   */
  textColor(hex: string): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return 'rgba(0,0,0,0.82)';
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.52 ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.88)';
  }

  mutedColor(hex: string): string {
    const base = this.textColor(hex);
    return base.startsWith('rgba(0') ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.55)';
  }

  // ── Positions (localStorage) ──────────────────────────────────────────────

  private autoArrangeNew(notes: Note[]): void {
    const saved   = this.positions();
    const updated = { ...saved };
    let changed   = false;
    const COLS = 4, CW = 248, CH = 220, GAP = 36, OX = 40, OY = 40;
    notes.forEach((n, i) => {
      if (!updated[n.id]) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        updated[n.id] = {
          x:        OX + col * (CW + GAP) + (Math.random() - 0.5) * 18,
          y:        OY + row * (CH + GAP) + (Math.random() - 0.5) * 18,
          rotation: (Math.random() - 0.5) * 6
        };
        changed = true;
      }
    });
    if (changed) { this.positions.set(updated); this.savePositions(); }
  }

  private loadPositions(): void {
    try {
      const raw = localStorage.getItem(POSITIONS_KEY);
      if (raw) this.positions.set(JSON.parse(raw));
    } catch { /* ignore corrupt data */ }
  }

  private savePositions(): void {
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(this.positions())); } catch { /**/ }
  }

  trackById(_: number, note: Note): string { return note.id; }
}
