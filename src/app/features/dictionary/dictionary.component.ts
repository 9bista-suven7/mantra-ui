import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VOCAB_WORDS } from '../dashboard/daily-data';

/** Result entry from dictionaryapi.dev. */
interface DictionaryEntry {
  word: string;
  phonetic?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
}

/**
 * Dedicated Dictionary page — search any English word and view its full
 * definition. Also shows the daily "Words of the Day" list as quick picks.
 */
@Component({
  selector: 'app-dictionary',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dictionary.component.html',
  styleUrl: './dictionary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictionaryComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly query   = signal('');
  readonly result  = signal<DictionaryEntry[] | null>(null);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly wordsOfDay = signal<string[]>([]);

  ngOnInit(): void {
    this.seedWordsOfTheDay();
  }

  search(term?: string): void {
    const word = (term ?? this.query()).trim().toLowerCase();
    if (!word) return;
    this.query.set(word);
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.http.get<DictionaryEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    ).subscribe({
      next: list => {
        this.loading.set(false);
        if (!list?.length) { this.error.set('No definition found.'); return; }
        this.result.set(list);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No definition found.');
      },
    });
  }

  pickWord(w: string): void { this.search(w); }

  private seedWordsOfTheDay(): void {
    const start  = new Date(new Date().getFullYear(), 0, 0);
    const dayNum = Math.floor((Date.now() - start.getTime()) / 86_400_000);
    const offset = (dayNum * 5) % VOCAB_WORDS.length;
    const out: string[] = [];
    for (let i = 0; i < 10; i++) out.push(VOCAB_WORDS[(offset + i) % VOCAB_WORDS.length]);
    this.wordsOfDay.set(out);
  }
}
