import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GroupDto, MessageDto, SendMessageRequest, CreateGroupRequest } from '../../models/chat.model';

const BASE = '/api/chat/groups';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);

  listGroups(): Observable<GroupDto[]> {
    return this.http.get<GroupDto[]>(BASE);
  }

  createGroup(req: CreateGroupRequest): Observable<GroupDto> {
    return this.http.post<GroupDto>(BASE, req);
  }

  getMessages(groupId: string, before?: string, page = 0): Observable<MessageDto[]> {
    let params = new HttpParams().set('page', page);
    if (before) params = params.set('before', before);
    return this.http.get<MessageDto[]>(`${BASE}/${groupId}/messages`, { params });
  }

  sendMessage(groupId: string, req: SendMessageRequest): Observable<MessageDto> {
    return this.http.post<MessageDto>(`${BASE}/${groupId}/messages`, req);
  }

  addMember(groupId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/${groupId}/members`, { userId });
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${groupId}/members/${userId}`);
  }

  /** Leave / hide group from current user's sidebar. */
  leaveGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${groupId}`);
  }

  markRead(groupId: string): Observable<void> {
    return this.http.put<void>(`${BASE}/${groupId}/read`, {});
  }
}
