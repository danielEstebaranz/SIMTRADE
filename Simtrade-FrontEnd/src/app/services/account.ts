import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthUser } from './auth';
import { AppTheme } from './theme';

export interface AccountSettings {
  theme: AppTheme;
}

export interface SettingsResponse {
  message?: string;
  settings: AccountSettings;
  user: AuthUser;
}

export interface AddFundsResponse {
  message: string;
  operation: {
    amount: number;
    balance: number;
  };
  user: AuthUser;
}

export interface ResetPortfolioResponse {
  message: string;
  operation: {
    balance: number;
  };
  user: AuthUser;
}

export interface DeleteAccountResponse {
  deleted_bonds?: number;
  deleted_transactions: number;
  message: string;
}

export interface BondOffer {
  duration_seconds: number;
  name: string;
  return_percent: number;
  ticker: string;
}

export interface BondItem {
  amount: number;
  balanceAfterSettlement?: number;
  durationSeconds: number;
  id: string;
  maturityAt: string | null;
  name: string;
  payout: number;
  profit: number;
  returnPercent: number;
  secondsRemaining: number;
  settledAt: string | null;
  startedAt: string | null;
  status: 'active' | 'settled';
  ticker: string;
}

export interface BondOffersResponse {
  items: BondOffer[];
}

export interface BondsResponse {
  active: BondItem[];
  items: BondItem[];
  settled: BondItem[];
  user: AuthUser;
}

export interface CreateBondResponse {
  bond: BondItem;
  message: string;
  operation: {
    amount: number;
    balance: number;
  };
  user: AuthUser;
}

export interface SettleBondsResponse {
  items: BondItem[];
  message: string;
  settledCount: number;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://127.0.0.1:8000';

  getSettings(token: string): Observable<SettingsResponse> {
    return this.http.get<SettingsResponse>(`${this.apiUrl}/users/me/settings`, this.authOptions(token));
  }

  updateSettings(token: string, theme: AppTheme): Observable<SettingsResponse> {
    return this.http.patch<SettingsResponse>(
      `${this.apiUrl}/users/me/settings`,
      { theme },
      this.authOptions(token),
    );
  }

  addFunds(token: string, amount: number): Observable<AddFundsResponse> {
    return this.http.post<AddFundsResponse>(
      `${this.apiUrl}/users/me/funds`,
      { amount },
      this.authOptions(token),
    );
  }

  withdrawFunds(token: string, amount: number): Observable<AddFundsResponse> {
    return this.http.post<AddFundsResponse>(
      `${this.apiUrl}/users/me/funds/withdraw`,
      { amount },
      this.authOptions(token),
    );
  }

  resetPortfolio(token: string, confirmation: string, password: string): Observable<ResetPortfolioResponse> {
    return this.http.post<ResetPortfolioResponse>(
      `${this.apiUrl}/users/me/portfolio/reset`,
      { confirmation, password },
      this.authOptions(token),
    );
  }

  deleteAccount(token: string, password: string): Observable<DeleteAccountResponse> {
    return this.http.post<DeleteAccountResponse>(
      `${this.apiUrl}/users/me/delete`,
      { password },
      this.authOptions(token),
    );
  }

  getBondOffers(): Observable<BondOffersResponse> {
    return this.http.get<BondOffersResponse>(`${this.apiUrl}/bonds/offers`);
  }

  getBonds(token: string): Observable<BondsResponse> {
    return this.http.get<BondsResponse>(`${this.apiUrl}/users/me/bonds`, this.authOptions(token));
  }

  createBond(token: string, ticker: string, amount: number): Observable<CreateBondResponse> {
    return this.http.post<CreateBondResponse>(
      `${this.apiUrl}/users/me/bonds`,
      { amount, ticker },
      this.authOptions(token),
    );
  }

  settleBonds(token: string): Observable<SettleBondsResponse> {
    return this.http.post<SettleBondsResponse>(
      `${this.apiUrl}/users/me/bonds/settle`,
      {},
      this.authOptions(token),
    );
  }

  private authOptions(token: string): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
      }),
    };
  }
}
