import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent)
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },

  {
    path: 'app',
    loadComponent: () =>
      import('./features/layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'splitwise',
        loadComponent: () =>
          import('./features/splitwise/splitwise.component').then(m => m.SplitwiseComponent)
      },
      {
        path: 'reminders',
        loadComponent: () =>
          import('./features/reminders/reminders.component').then(m => m.RemindersComponent)
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./features/notes/notes.component').then(m => m.NotesComponent)
      },
      {
        path: 'bills',
        loadComponent: () =>
          import('./features/bills/bills.component').then(m => m.BillsComponent)
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'todo',
        loadComponent: () =>
          import('./features/todo/todo.component').then(m => m.TodoComponent)
      },
      {
        path: 'market',
        loadComponent: () =>
          import('./features/market/market.component').then(m => m.MarketComponent)
      },
      {
        path: 'converter',
        loadComponent: () =>
          import('./features/converter/converter.component').then(m => m.ConverterComponent)
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.component').then(m => m.CalendarComponent)
      },
      {
        path: 'weather',
        loadComponent: () =>
          import('./features/weather/weather.component').then(m => m.WeatherComponent)
      },
      {
        path: 'dictionary',
        loadComponent: () =>
          import('./features/dictionary/dictionary.component').then(m => m.DictionaryComponent)
      },
      {
        path: 'horoscope',
        loadComponent: () =>
          import('./features/horoscope/horoscope.component').then(m => m.HoroscopeComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];

