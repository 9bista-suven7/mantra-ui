import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConversationDto,
  MessageDto,
  SendMessageRequest,
  FileUploadResponse,
  UserSearchResult
} from '../../models/chat.model';

const BASE = '/api/chat';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  listConversations(): Observable<ConversationDto[]> {
    return this.http.get<ConversationDto[]>(`${BASE}/conversations`);
  }

  getOrCreateConversation(otherUserId: string): Observable<ConversationDto> {
    return this.http.post<ConversationDto>(`${BASE}/conversations/with/${otherUserId}`, {});
  }

  getMessages(conversationId: string, before?: string, page = 0): Observable<MessageDto[]> {
    let params = new HttpParams().set('page', page);
    if (before) params = params.set('before', before);
    return this.http.get<MessageDto[]>(`${BASE}/conversations/${conversationId}/messages`, { params });
  }

  sendMessage(conversationId: string, req: SendMessageRequest): Observable<MessageDto> {
    return this.http.post<MessageDto>(`${BASE}/conversations/${conversationId}/messages`, req);
  }

  markRead(conversationId: string): Observable<void> {
    return this.http.put<void>(`${BASE}/conversations/${conversationId}/read`, {});
  }

  deleteMessage(messageId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/messages/${messageId}`);
  }

  /** Hide a 1-to-1 conversation from the current user's sidebar. */
  hideConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/conversations/${conversationId}`);
  }

  uploadFile(file: File): Observable<FileUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<FileUploadResponse>(`${BASE}/files`, form);
  }

  searchUsers(q: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>('/api/users/search', { params: { q } });
  }
}
