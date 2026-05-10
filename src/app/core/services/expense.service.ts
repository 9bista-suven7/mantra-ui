import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AddExpenseRequest, BalanceSummary, CreateGroupRequest,
  Expense, ExpenseGroup, GroupMember, Settlement, SettleRequest
} from '../../models/expense.model';
import { ApiResponse } from '../../models/bill.model';

/** Expense groups, expenses, balances, and settlements API client. */
@Injectable({ providedIn: 'root' })
export class ExpenseService {

  private readonly http = inject(HttpClient);
  private readonly base = '/api/expenses';

  getGroups(): Observable<ExpenseGroup[]> {
    return this.http.get<ExpenseGroup[]>(`${this.base}/groups`);
  }

  createGroup(req: CreateGroupRequest): Observable<ApiResponse<ExpenseGroup>> {
    return this.http.post<ApiResponse<ExpenseGroup>>(`${this.base}/groups`, req);
  }

  getGroup(groupId: string): Observable<ApiResponse<ExpenseGroup>> {
    return this.http.get<ApiResponse<ExpenseGroup>>(`${this.base}/groups/${groupId}`);
  }

  getGroupMembers(groupId: string): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(`${this.base}/groups/${groupId}/members`);
  }

  addExpense(groupId: string, req: AddExpenseRequest): Observable<ApiResponse<Expense>> {
    return this.http.post<ApiResponse<Expense>>(`${this.base}/groups/${groupId}/expenses`, req);
  }

  getGroupExpenses(groupId: string): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.base}/groups/${groupId}/expenses`);
  }

  deleteExpense(groupId: string, expenseId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/groups/${groupId}/expenses/${expenseId}`);
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/groups/${groupId}`);
  }

  addGroupMember(groupId: string, email: string): Observable<ApiResponse<ExpenseGroup>> {
    return this.http.post<ApiResponse<ExpenseGroup>>(`${this.base}/groups/${groupId}/members`, { email });
  }

  removeGroupMember(groupId: string, userId: string): Observable<ApiResponse<ExpenseGroup>> {
    return this.http.delete<ApiResponse<ExpenseGroup>>(`${this.base}/groups/${groupId}/members/${userId}`);
  }

  getGroupBalances(groupId: string): Observable<ApiResponse<BalanceSummary>> {
    return this.http.get<ApiResponse<BalanceSummary>>(`${this.base}/groups/${groupId}/balances`);
  }

  settle(req: SettleRequest): Observable<ApiResponse<Settlement>> {
    return this.http.post<ApiResponse<Settlement>>(`${this.base}/settle`, req);
  }
}
