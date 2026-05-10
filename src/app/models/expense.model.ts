export interface ExpenseGroup {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  category: string;
  createdById: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  email: string;
  initials: string;
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
  splits: Record<string, number>;
  settled: boolean;
  expenseDate: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  notes?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  settledAt: string;
}

export interface BalanceSummary {
  groupId: string;
  currency: string;
  netBalances: Record<string, number>;
  suggestions: PaymentSuggestion[];
}

export interface PaymentSuggestion {
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
  currency: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  emoji?: string;
  category?: string;
  memberEmails?: string[];
}

export interface AddExpenseRequest {
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
  splits?: Record<string, number>;
  expenseDate?: string;
  paidByUserId?: string;
}

export interface SettleRequest {
  groupId: string;
  toUserId: string;
  amount: number;
  currency?: string;
  notes?: string;
}
