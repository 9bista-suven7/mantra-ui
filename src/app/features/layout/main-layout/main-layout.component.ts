import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { InactivityService } from '../../../core/services/inactivity.service';
import { AuthService } from '../../../core/services/auth.service';


@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent implements OnInit {
  protected readonly inactivity = inject(InactivityService);
  private  readonly auth        = inject(AuthService);
  private  readonly destroyRef  = inject(DestroyRef);

  ngOnInit(): void {
    this.inactivity.start(this.destroyRef);
  }

  /** Immediately signs the user out from the warning modal. */
  protected signOutNow(): void {
    this.auth.logout();
  }
}
