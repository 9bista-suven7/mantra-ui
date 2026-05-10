import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Todo, TodoRequest, TodoStatus } from '../../models/todo.model';
import { ApiResponse } from '../../models/bill.model';

/** Todo CRUD API client. */
@Injectable({ providedIn: 'root' })
export class TodoService {

  private readonly http = inject(HttpClient);
  private readonly base = '/api/todos';

  getAll(status?: TodoStatus): Observable<Todo[]> {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<Todo[]>(this.base, { params });
  }

  create(req: TodoRequest): Observable<Todo> {
    return this.http.post<ApiResponse<Todo>>(this.base, req).pipe(map(r => r.data));
  }

  update(id: string, req: TodoRequest): Observable<Todo> {
    return this.http.put<ApiResponse<Todo>>(`${this.base}/${id}`, req).pipe(map(r => r.data));
  }

  complete(id: string): Observable<Todo> {
    return this.http.patch<ApiResponse<Todo>>(`${this.base}/${id}/complete`, {}).pipe(map(r => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
