// ─── Chat domain models (mirrors backend DTOs) ──────────────────────────────

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'EMOJI' | 'SYSTEM';
export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface AttachmentDto {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface ReadReceiptDto {
  userId: string;
  readAt: string;
}

export interface MessageDto {
  id: string;
  conversationId?: string;
  groupId?: string;
  senderId: string;
  senderDisplayName?: string;
  senderAvatarColor?: string;
  type: MessageType;
  content?: string;
  attachment?: AttachmentDto;
  readReceipts: ReadReceiptDto[];
  status: MessageStatus;
  replyToMessageId?: string;
  deleted: boolean;
  editedContent?: string;
  editedAt?: string;
  createdAt: string;
}

export interface ParticipantDto {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface LastMessageSummary {
  content: string;
  senderId: string;
  type: MessageType;
  sentAt: string;
}

export interface ConversationDto {
  id: string;
  otherUser: ParticipantDto;
  lastMessage?: LastMessageSummary;
  unreadCount: number;
  otherUserOnline: boolean;
  updatedAt: string;
}

export interface GroupMemberDto {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  /** Set when this chat group was auto-created from a Splitwise expense group. */
  linkedExpenseGroupId?: string;
  members: GroupMemberDto[];
  lastMessage?: LastMessageSummary;
  unreadCount: number;
  archived: boolean;
  updatedAt: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberIds: string[];
  /** Optional — set when creating from a Splitwise expense group. */
  linkedExpenseGroupId?: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor?: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  groupId?: string;
  type: MessageType;
  content?: string;
  fileId?: string;
  replyToMessageId?: string;
}

// ─── WebSocket event types ───────────────────────────────────────────────────

export type ChatEventType =
  | 'NEW_MESSAGE'
  | 'MESSAGE_STATUS_UPDATE'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'PRESENCE_UPDATE'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  | 'GROUP_UPDATED'
  | 'MESSAGE_DELETED'
  | 'MESSAGE_EDITED';

export interface ChatEvent<T = unknown> {
  type: ChatEventType;
  targetId: string;
  payload: T;
}

export interface TypingEvent {
  userId: string;
  displayName: string;
  targetId: string;
  typing: boolean;
}

export interface PresenceEvent {
  userId: string;
  displayName: string;
  online: boolean;
  lastSeenAt?: string;
}

export interface FileUploadResponse {
  fileId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl?: string;
}
