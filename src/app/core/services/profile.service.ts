import { Injectable, signal } from '@angular/core';

/** Extended profile fields beyond what the auth token provides. */
export interface ProfileExt {
  phone: string;
  bio: string;
  location: string;
  /** Birth date in ISO format (YYYY-MM-DD); empty string if unset. */
  dob: string;
}

const AVATAR_KEY  = 'mantra_avatar';
const EXT_KEY     = 'mantra_profile_ext';
const DEFAULT_EXT: ProfileExt = { phone: '', bio: '', location: '', dob: '' };

/**
 * Singleton service that manages the user's local profile data:
 *  - Profile photo (stored as a base64 data-URL in localStorage)
 *  - Extended fields: phone, bio, location (stored as JSON in localStorage)
 *
 * All state is exposed as readonly signals for reactive consumption.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {

  private readonly _avatarDataUrl = signal<string | null>(
    localStorage.getItem(AVATAR_KEY)
  );

  private readonly _ext = signal<ProfileExt>(this.loadExt());

  /** Base64 data-URL of the profile photo, or null if none set. */
  readonly avatarDataUrl = this._avatarDataUrl.asReadonly();

  /** Extended profile fields (phone, bio, location). */
  readonly ext = this._ext.asReadonly();

  /**
   * Persist a new profile photo as a base64 data-URL.
   * @param dataUrl Result of FileReader.readAsDataURL()
   */
  setAvatar(dataUrl: string): void {
    localStorage.setItem(AVATAR_KEY, dataUrl);
    this._avatarDataUrl.set(dataUrl);
  }

  /** Remove the current profile photo. */
  removeAvatar(): void {
    localStorage.removeItem(AVATAR_KEY);
    this._avatarDataUrl.set(null);
  }

  /**
   * Persist extended profile fields (partial update supported).
   * @param ext Fields to update — unspecified fields are preserved.
   */
  saveExt(ext: Partial<ProfileExt>): void {
    const updated = { ...this._ext(), ...ext };
    localStorage.setItem(EXT_KEY, JSON.stringify(updated));
    this._ext.set(updated);
  }

  private loadExt(): ProfileExt {
    try {
      const raw = localStorage.getItem(EXT_KEY);
      return raw ? { ...DEFAULT_EXT, ...JSON.parse(raw) } : { ...DEFAULT_EXT };
    } catch {
      return { ...DEFAULT_EXT };
    }
  }
}
