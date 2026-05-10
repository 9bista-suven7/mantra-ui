import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener,
  Input, forwardRef, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Custom dropdown that fully replaces the native `<select>` element.
 * Eliminates the Windows white-flash that appears when the browser
 * paints the native OS popup. Works with both [(ngModel)] and
 * formControlName via ControlValueAccessor.
 */
@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cs-wrap" [class.open]="open()" [class.disabled]="disabled">
      <button type="button" class="cs-btn"
              [disabled]="disabled"
              (click)="toggle()"
              (blur)="onBlur()">
        <span class="cs-label">{{ displayLabel() }}</span>
        <span class="material-symbols-rounded cs-caret">expand_more</span>
      </button>
      @if (open()) {
        <ul class="cs-menu" role="listbox">
          @for (o of options; track o.value) {
            <li role="option"
                [class.active]="o.value === value()"
                (mousedown)="pick(o.value)">{{ o.label }}</li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './custom-select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true,
    },
  ],
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() disabled = false;

  readonly value = signal<string>('');
  readonly open  = signal<boolean>(false);
  readonly displayLabel = computed(() => {
    const v = this.value();
    return this.options.find(o => o.value === v)?.label ?? this.placeholder;
  });

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(): void { if (!this.disabled) this.open.update(v => !v); }
  onBlur(): void { setTimeout(() => this.open.set(false), 120); this.onTouched(); }
  pick(v: string): void {
    this.value.set(v);
    this.onChange(v);
    this.open.set(false);
  }

  // Close when clicking outside
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) {
      this.open.set(false);
    }
  }
  @HostListener('document:keydown.escape')
  onEsc(): void { this.open.set(false); }

  // ── ControlValueAccessor ────────────────────────────────────────────
  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}
