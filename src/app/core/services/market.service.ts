import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  imageUrl: string;
}

export interface MetalPrice {
  name: string;
  unit: string;
  priceUsd: number;
  priceNpr: number;
  priceTolaNpr: number;
}

export interface CurrencyRate {
  code: string;
  name: string;
  flag: string;
  rateUsd: number;
}

export interface MarketData {
  cryptos: CryptoPrice[];
  metals: MetalPrice[];
  currencies: CurrencyRate[];
  usdNprRate: number;
  updatedAt: string;
}

export interface StockIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly http = inject(HttpClient);

  getMarketData(): Observable<MarketData> {
    return this.http.get<MarketData>('/api/market');
  }

  getStockIndices(): Observable<StockIndex[]> {
    return this.http.get<StockIndex[]>('/api/market/indices');
  }
}
