import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';

/** Persisted user preferences (stored in localStorage). */
interface AppPreferences {
  accentColor: string;
  animationsEnabled: boolean;
  defaultPage: string;
  currency: string;
  dateFormat: string;
  notifyReminders: boolean;
  notifyBills: boolean;
  notifyMarket: boolean;
  notifyChat: boolean;
}

const PREFS_KEY = 'mantra_prefs';

const DEFAULT_PREFS: AppPreferences = {
  accentColor: '#6c63ff',
  animationsEnabled: true,
  defaultPage: 'dashboard',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  notifyReminders: true,
  notifyBills: true,
  notifyMarket: false,
  notifyChat: true,
};

/**
 * Settings page — Profile, Appearance, Notifications, Preferences, Security, About.
 * All preferences are persisted to localStorage under 'mantra_prefs'.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {

  protected readonly auth    = inject(AuthService);
  protected readonly profile = inject(ProfileService);

  // ── Avatar upload ─────────────────────────────────────────────
  private readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('settingsAvatarInput');

  triggerAvatarUpload(): void {
    this.avatarInput()?.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.profile.setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }

  // ── Extended profile (phone / bio / location / dob) ─────────────
  readonly phoneInput    = signal(inject(ProfileService).ext().phone);
  readonly bioInput      = signal(inject(ProfileService).ext().bio);
  readonly locationInput = signal(inject(ProfileService).ext().location);
  readonly dobInput      = signal(inject(ProfileService).ext().dob);
  readonly extSaved      = signal(false);

  saveExtProfile(): void {
    this.profile.saveExt({
      phone:    this.phoneInput().trim(),
      bio:      this.bioInput().trim(),
      location: this.locationInput().trim(),
      dob:      this.dobInput().trim(),
    });
    this.extSaved.set(true);
    setTimeout(() => this.extSaved.set(false), 2500);
 }

  // ── Profile ──────────────────────────────────────────────────
  readonly editingDisplayName = signal(false);
  readonly displayNameInput   = signal('');
  readonly profileSaved       = signal(false);

  // ── Preferences ──────────────────────────────────────────────
  readonly prefs = signal<AppPreferences>(this.loadPrefs());

  // ── Security ──────────────────────────────────────────────────
  readonly oldPassword     = signal('');
  readonly newPassword     = signal('');
  readonly confirmPassword = signal('');
  readonly passwordError   = signal('');
  readonly passwordSuccess = signal(false);

  // ── Config ────────────────────────────────────────────────────
  readonly accentColors = [
    { hex: '#6c63ff', name: 'Violet'  },
    { hex: '#4ecca3', name: 'Emerald' },
    { hex: '#3b82f6', name: 'Blue'    },
    { hex: '#ec4899', name: 'Pink'    },
    { hex: '#f59e0b', name: 'Amber'   },
    { hex: '#10b981', name: 'Green'   },
    { hex: '#ef4444', name: 'Red'     },
    { hex: '#a855f7', name: 'Purple'  },
  ];

  readonly pages = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'chat',      label: 'Chat'      },
    { value: 'todo',      label: 'Todo'      },
    { value: 'notes',     label: 'Notes'     },
    { value: 'market',    label: 'Market'    },
  ];

  readonly currencies  = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD'];
  readonly dateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

  // ── Preferences helpers ────────────────────────────────────────

  /** Load stored prefs, merging with defaults for any missing keys. */
  private loadPrefs(): AppPreferences {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : { ...DEFAULT_PREFS };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  /** Update a single preference key and persist. */
  setPref<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]): void {
    this.prefs.update(p => {
      const next = { ...p, [key]: value };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }

  // ── Profile actions ───────────────────────────────────────────

  /** Enter edit mode for display name. */
  startEditName(): void {
    this.displayNameInput.set(this.auth.currentUser()?.displayName ?? '');
    this.editingDisplayName.set(true);
    this.profileSaved.set(false);
  }

  /** Persist updated display name to the stored user object. */
  saveDisplayName(): void {
    const name = this.displayNameInput().trim();
    if (!name) return;
    try {
      const raw = localStorage.getItem('mantra_user');
      if (raw) {
        const user = JSON.parse(raw);
        user.displayName = name;
        localStorage.setItem('mantra_user', JSON.stringify(user));
      }
    } catch { /* ignore */ }
    this.editingDisplayName.set(false);
    this.profileSaved.set(true);
    setTimeout(() => this.profileSaved.set(false), 3000);
  }

  cancelEditName(): void {
    this.editingDisplayName.set(false);
  }

  // ── Security actions ──────────────────────────────────────────

  /** Validate and submit password change. */
  changePassword(): void {
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    const old     = this.oldPassword().trim();
    const next    = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();

    if (!old || !next || !confirm) {
      this.passwordError.set('All fields are required.');
      return;
    }
    if (next.length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      this.passwordError.set('Passwords do not match.');
      return;
    }
    // TODO: wire to /api/auth/change-password once the endpoint exists
    this.passwordSuccess.set(true);
    this.oldPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    setTimeout(() => this.passwordSuccess.set(false), 4000);
  }

  // ── Danger zone ────────────────────────────────────────────────

  clearLocalData(): void {
    const keep = ['mantra_token', 'mantra_user'];
    Object.keys(localStorage)
      .filter(k => !keep.includes(k))
      .forEach(k => localStorage.removeItem(k));
    this.prefs.set({ ...DEFAULT_PREFS });
  }

  confirmDeleteAccount(): void {
    // TODO: call backend delete endpoint before logout
    if (confirm('Are you sure? This will permanently delete your account and all data.')) {
      this.auth.logout();
    }
  }

  /** Smooth-scroll to a section by id (avoids router intercepting hash links). */
  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
