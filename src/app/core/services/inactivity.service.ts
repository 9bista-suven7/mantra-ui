import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Tracks user inactivity and auto-logs out after a configurable idle period.
 *
 * Flow:
 *   1. Activity events reset the idle timer.
 *   2. After IDLE_TIMEOUT - WARN_BEFORE milliseconds of inactivity,
 *      a warning modal is shown with a live countdown.
 *   3. If the user clicks "Stay Signed In", the timer resets.
 *   4. If the countdown reaches 0 (or WARN_BEFORE elapses), the session
 *      is forcibly logged out.
 *
 * Usage: inject into MainLayoutComponent and call start(destroyRef).
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {

  /** Total idle time before logout (30 minutes). */
  private static readonly IDLE_TIMEOUT_MS = 30 * 60 * 1_000;

  /** How many seconds before logout the warning appears (60 seconds). */
  private static readonly WARN_SECONDS = 60;

  private readonly auth = inject(AuthService);

  /** True when the "Session expiring" warning modal should be visible. */
  readonly isWarning   = signal(false);

  /** Seconds remaining on the warning countdown (60 → 0). */
  readonly countdown   = signal(InactivityService.WARN_SECONDS);

  private idleTimer?:      ReturnType<typeof setTimeout>;
  private warnTimer?:      ReturnType<typeof setTimeout>;
  private countdownTimer?: ReturnType<typeof setInterval>;

  // Reference kept so we can removeEventListener with the exact same function
  private readonly activityHandler = () => this.onActivity();

  private readonly ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll',
  ] as const;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Starts tracking inactivity. Should be called from the main layout.
   * Automatically cleans up on destroyRef.onDestroy.
   */
  start(destroyRef: DestroyRef): void {
    this.ACTIVITY_EVENTS.forEach(evt =>
      document.addEventListener(evt, this.activityHandler, { passive: true })
    );

    destroyRef.onDestroy(() => this.stop());

    this.resetIdleTimer();
  }

  /**
   * User chose "Stay Signed In" — dismiss warning and reset the timer.
   */
  extendSession(): void {
    this.isWarning.set(false);
    this.resetIdleTimer();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private stop(): void {
    this.ACTIVITY_EVENTS.forEach(evt =>
      document.removeEventListener(evt, this.activityHandler)
    );
    this.clearAllTimers();
    this.isWarning.set(false);
  }

  private onActivity(): void {
    // Only reset when not already in the warning phase —
    // once the warning is showing, only the explicit button resets it.
    if (!this.isWarning()) {
      this.resetIdleTimer();
    }
  }

  private resetIdleTimer(): void {
    this.clearAllTimers();
    this.idleTimer = setTimeout(
      () => this.showWarning(),
      InactivityService.IDLE_TIMEOUT_MS - InactivityService.WARN_SECONDS * 1_000,
    );
  }

  private showWarning(): void {
    this.isWarning.set(true);
    this.countdown.set(InactivityService.WARN_SECONDS);

    let remaining = InactivityService.WARN_SECONDS;

    this.countdownTimer = setInterval(() => {
      remaining--;
      this.countdown.set(remaining);
      if (remaining <= 0) {
        this.forceLogout();
      }
    }, 1_000);

    // Belt-and-suspenders: hard timeout in case setInterval drifts
    this.warnTimer = setTimeout(
      () => this.forceLogout(),
      InactivityService.WARN_SECONDS * 1_000 + 500,
    );
  }

  private forceLogout(): void {
    this.clearAllTimers();
    this.isWarning.set(false);
    this.auth.logout();
  }

  private clearAllTimers(): void {
    if (this.idleTimer)      { clearTimeout(this.idleTimer);       this.idleTimer      = undefined; }
    if (this.warnTimer)      { clearTimeout(this.warnTimer);       this.warnTimer      = undefined; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = undefined; }
  }
}
