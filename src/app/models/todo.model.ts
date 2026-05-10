export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Todo {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  dueDate?: string;
  tags?: string[];
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TodoRequest {
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string;
  tags?: string[];
  status?: TodoStatus;
}
