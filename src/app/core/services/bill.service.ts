import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bill, BillCategory, BillRequest, BillStatus, ApiResponse } from '../../models/bill.model';

/** Bills CRUD API client. */
@Injectable({ providedIn: 'root' })
export class BillService {

  private readonly http = inject(HttpClient);
  private readonly base = '/api/bills';

  getAll(): Observable<Bill[]> {
    return this.http.get<Bill[]>(this.base);
  }

  getUpcoming(): Observable<Bill[]> {
    return this.http.get<Bill[]>(`${this.base}/upcoming`);
  }

  getByStatus(status: BillStatus): Observable<Bill[]> {
    return this.http.get<Bill[]>(`${this.base}/status/${status}`);
  }

  getByCategory(category: BillCategory): Observable<Bill[]> {
    return this.http.get<Bill[]>(`${this.base}/category/${category}`);
  }

  create(req: BillRequest): Observable<ApiResponse<Bill>> {
    return this.http.post<ApiResponse<Bill>>(this.base, req);
  }

  update(id: string, req: BillRequest): Observable<ApiResponse<Bill>> {
    return this.http.put<ApiResponse<Bill>>(`${this.base}/${id}`, req);
  }

  markPaid(id: string): Observable<ApiResponse<Bill>> {
    return this.http.patch<ApiResponse<Bill>>(`${this.base}/${id}/pay`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Uploads a receipt image/PDF for an existing bill.
   * Uses multipart/form-data with field name "file".
   */
  uploadReceipt(id: string, file: File): Observable<ApiResponse<Bill>> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ApiResponse<Bill>>(`${this.base}/${id}/receipt`, fd);
  }

  /** Removes the receipt attachment from a bill. */
  deleteReceipt(id: string): Observable<ApiResponse<Bill>> {
    return this.http.delete<ApiResponse<Bill>>(`${this.base}/${id}/receipt`);
  }
}
