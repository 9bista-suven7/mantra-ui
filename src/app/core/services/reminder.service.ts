import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reminder, ReminderRequest } from '../../models/reminder.model';
import { ApiResponse } from '../../models/bill.model';

/** Reminders CRUD API client. */
@Injectable({ providedIn: 'root' })
export class ReminderService {

  private readonly http = inject(HttpClient);
  private readonly base = '/api/reminders';

  getAll(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(this.base);
  }

  getUpcoming(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.base}/upcoming`);
  }

  create(req: ReminderRequest): Observable<ApiResponse<Reminder>> {
    return this.http.post<ApiResponse<Reminder>>(this.base, req);
  }

  update(id: string, req: ReminderRequest): Observable<ApiResponse<Reminder>> {
    return this.http.put<ApiResponse<Reminder>>(`${this.base}/${id}`, req);
  }

  complete(id: string): Observable<ApiResponse<Reminder>> {
    return this.http.patch<ApiResponse<Reminder>>(`${this.base}/${id}/complete`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
