export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ReminderStatus = 'PENDING' | 'COMPLETED' | 'SNOOZED' | 'CANCELLED';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  reminderTime: string;
  recurrence: RecurrenceType;
  tags?: string[];
  priority: Priority;
  status: ReminderStatus;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRequest {
  title: string;
  description?: string;
  reminderTime: string;
  recurrence?: RecurrenceType;
  priority?: Priority;
  tags?: string[];
}
