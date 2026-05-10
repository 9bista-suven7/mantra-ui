export type BillCategory =
  | 'UTILITY' | 'SUBSCRIPTION' | 'RENT' | 'INSURANCE'
  | 'MEDICAL' | 'EDUCATION' | 'ENTERTAINMENT' | 'FOOD'
  | 'TRANSPORT' | 'OTHER';

export type BillStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Bill {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: BillCategory;
  amount: number;
  currency: string;
  dueDate?: string;
  status: BillStatus;
  recurring: boolean;
  recurrencePattern?: string;
  tags?: string[];
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillRequest {
  title: string;
  description?: string;
  category: BillCategory;
  amount: number;
  currency?: string;
  dueDate?: string;
  recurring?: boolean;
  recurrencePattern?: string;
  tags?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}
