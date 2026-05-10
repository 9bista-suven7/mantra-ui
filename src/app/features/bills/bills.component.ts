import {
  ChangeDetectionStrategy, Component, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Bill, BillCategory, BillRequest, BillStatus } from '../../models/bill.model';
import { BillService } from '../../core/services/bill.service';
import { CustomSelectComponent, SelectOption } from '../../shared/components/custom-select/custom-select.component';

const CATEGORY_ICONS: Record<BillCategory, string> = {
  UTILITY: '⚡', SUBSCRIPTION: '📺', RENT: '🏠', INSURANCE: '🛡️',
  MEDICAL: '🏥', EDUCATION: '📚', ENTERTAINMENT: '🎬', FOOD: '🍔',
  TRANSPORT: '🚗', OTHER: '📄'
};

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './bills.component.html',
  styleUrl: './bills.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillsComponent implements OnInit {

  private readonly svc = inject(BillService);
  private readonly fb = inject(FormBuilder);

  readonly bills = signal<Bill[]>([]);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly editId = signal<string | null>(null);
  readonly filterStatus = signal<BillStatus | 'ALL'>('ALL');

  /** Staged receipt file (selected but not yet uploaded) */
  readonly stagedFile = signal<File | null>(null);
  /** Data-URL preview of the staged file */
  readonly stagedPreview = signal<string | null>(null);

  readonly categories: BillCategory[] = [
    'UTILITY', 'SUBSCRIPTION', 'RENT', 'INSURANCE',
    'MEDICAL', 'EDUCATION', 'ENTERTAINMENT', 'FOOD', 'TRANSPORT', 'OTHER'
  ];

  // ── Custom-select option lists (no native <select> → no Windows white-flash) ──
  readonly currencyOptions: SelectOption[] = [
    { value: 'USD', label: 'USD $' },
    { value: 'EUR', label: 'EUR €' },
    { value: 'INR', label: 'INR ₹' },
    { value: 'NPR', label: 'NPR Rs' },
    { value: 'GBP', label: 'GBP £' },
    { value: 'JPY', label: 'JPY ¥' },
  ];
  readonly recurrenceOptions: SelectOption[] = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'WEEKLY',  label: 'Weekly' },
    { value: 'YEARLY',  label: 'Yearly' },
  ];
  get categoryOptions(): SelectOption[] {
    return this.categories.map(c => ({
      value: c,
      label: `${this.categoryIcon(c)} ${c.charAt(0)}${c.slice(1).toLowerCase()}`
    }));
  }

  readonly form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    category: ['UTILITY', Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    currency: ['USD'],
    dueDate: [''],
    recurring: [false],
    recurrencePattern: ['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: b => { this.bills.set(b); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  get filteredBills(): Bill[] {
    const s = this.filterStatus();
    if (s === 'ALL') return this.bills();
    return this.bills().filter(b => b.status === s);
  }

  openForm(bill?: Bill): void {
    this.stagedFile.set(null);
    this.stagedPreview.set(null);
    if (bill) {
      this.editId.set(bill.id);
      const dd = bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : '';
      this.form.patchValue({
        title: bill.title,
        description: bill.description ?? '',
        category: bill.category,
        amount: bill.amount as any,
        currency: bill.currency,
        dueDate: dd,
        recurring: bill.recurring,
        recurrencePattern: bill.recurrencePattern ?? ''
      });
    } else {
      this.editId.set(null);
      this.form.reset({ currency: 'USD', category: 'UTILITY', recurring: false });
    }
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    const req: BillRequest = {
      title: v.title!,
      description: v.description ?? '',
      category: (v.category as BillCategory)!,
      amount: v.amount!,
      currency: v.currency ?? 'USD',
      dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : undefined,
      recurring: v.recurring ?? false,
      recurrencePattern: v.recurrencePattern ?? ''
    };
    const op = this.editId()
      ? this.svc.update(this.editId()!, req)
      : this.svc.create(req);
    op.subscribe(res => {
      const savedId = res.data?.id ?? this.editId()!;
      const file = this.stagedFile();
      if (file && savedId) {
        this.svc.uploadReceipt(savedId, file).subscribe(() => {
          this.showForm.set(false);
          this.stagedFile.set(null);
          this.stagedPreview.set(null);
          this.load();
        });
      } else {
        this.showForm.set(false);
        this.load();
      }
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.stagedFile.set(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => this.stagedPreview.set(e.target?.result as string);
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        this.stagedPreview.set(null);
      }
    } else {
      this.stagedPreview.set(null);
    }
    // Reset the input so the same file can be re-selected
    input.value = '';
  }

  clearStagedFile(): void {
    this.stagedFile.set(null);
    this.stagedPreview.set(null);
  }

  removeReceipt(id: string): void {
    this.svc.deleteReceipt(id).subscribe(() => this.load());
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  markPaid(id: string): void {
    this.svc.markPaid(id).subscribe(() => this.load());
  }

  delete(id: string): void {
    this.svc.delete(id).subscribe(() => this.load());
  }

  categoryIcon(c: BillCategory): string { return CATEGORY_ICONS[c] ?? '📄'; }

  statusBadgeClass(s: BillStatus): string {
    return { PAID: 'badge-success', UNPAID: 'badge-warning', OVERDUE: 'badge-danger', CANCELLED: 'badge-info' }[s] ?? '';
  }

  isOverdue(bill: Bill): boolean {
    return bill.status === 'UNPAID' && !!bill.dueDate && new Date(bill.dueDate) < new Date();
  }

  formatCurrency(a: number, c = 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(a);
  }

  get totalUnpaid(): number {
    return this.bills().filter(b => b.status === 'UNPAID').reduce((s, b) => s + b.amount, 0);
  }

  get paidCount(): number {
    return this.bills().filter(b => b.status === 'PAID').length;
  }
}
