export interface Note {
  id: string;
  userId: string;
  title: string;
  content?: string;
  tags?: string[];
  color: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRequest {
  title: string;
  content?: string;
  tags?: string[];
  color?: string;
}
