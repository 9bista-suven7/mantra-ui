import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo, TodoRequest } from '../../models/todo.model';
import { TodoService } from '../../core/services/todo.service';

@Component({
  selector: 'app-todo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo.component.html',
  styleUrl: './todo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoComponent implements OnInit {

  private readonly svc = inject(TodoService);

  @ViewChild('addInput') addInput!: ElementRef<HTMLInputElement>;

  readonly todos   = signal<Todo[]>([]);
  readonly loading = signal(false);
  readonly newTitle = signal('');
  readonly showEmoji = signal(false);

  readonly EMOJIS = [
    '😊','😂','🥰','😎','🤔','😴','🥳','😤',
    '🎯','🔥','✅','⭐','💡','📌','🚀','🎉',
    '🏔️','🌿','☕','🎵','💪','🙏','👀','❤️',
    '🛒','📅','💼','🏠','🚗','✈️','📚','🎮',
  ];

  readonly pending  = computed(() => this.todos().filter(t => t.status !== 'DONE'));
  readonly done     = computed(() => this.todos().filter(t => t.status === 'DONE'));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next:  t  => { this.todos.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  addTask(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    const req: TodoRequest = { title };
    this.svc.create(req).subscribe(saved => {
      this.todos.update(list => [saved, ...list]);
      this.newTitle.set('');
      this.showEmoji.set(false);
    });
  }

  toggle(t: Todo): void {
    if (t.status === 'DONE') {
      // reopen: set back to TODO
      const req: TodoRequest = { title: t.title, status: 'TODO' };
      this.svc.update(t.id, req).subscribe(saved =>
        this.todos.update(list => list.map(x => x.id === t.id ? saved : x))
      );
    } else {
      this.svc.complete(t.id).subscribe(saved =>
        this.todos.update(list => list.map(x => x.id === t.id ? saved : x))
      );
    }
  }

  delete(id: string): void {
    this.svc.delete(id).subscribe(() =>
      this.todos.update(list => list.filter(t => t.id !== id))
    );
  }

  onEnter(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.addTask();
  }

  insertEmoji(emoji: string): void {
    this.newTitle.update(t => t + emoji);
    this.showEmoji.set(false);
    this.addInput?.nativeElement.focus();
  }
}
