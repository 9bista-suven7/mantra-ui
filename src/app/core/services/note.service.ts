import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Note, NoteRequest } from '../../models/note.model';
import { ApiResponse } from '../../models/bill.model';

/** Notes CRUD API client. */
@Injectable({ providedIn: 'root' })
export class NoteService {

  private readonly http = inject(HttpClient);
  private readonly base = '/api/notes';

  getAll(): Observable<Note[]> {
    return this.http.get<Note[]>(this.base);
  }

  getArchived(): Observable<Note[]> {
    return this.http.get<Note[]>(`${this.base}/archived`);
  }

  getByTag(tag: string): Observable<Note[]> {
    return this.http.get<Note[]>(`${this.base}/tag/${encodeURIComponent(tag)}`);
  }

  create(req: NoteRequest): Observable<ApiResponse<Note>> {
    return this.http.post<ApiResponse<Note>>(this.base, req);
  }

  update(id: string, req: NoteRequest): Observable<ApiResponse<Note>> {
    return this.http.put<ApiResponse<Note>>(`${this.base}/${id}`, req);
  }

  togglePin(id: string): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(`${this.base}/${id}/pin`, {});
  }

  toggleArchive(id: string): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(`${this.base}/${id}/archive`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
