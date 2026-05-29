import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService, BondItem, BondOffer } from '../../../../services/account';
import { AuthService } from '../../../../services/auth';

interface ActionState {
  errorMessage: string;
  status: 'idle' | 'loading' | 'saving' | 'success' | 'error';
  successMessage: string;
}

@Component({
  selector: 'app-bonos-section',
  imports: [ReactiveFormsModule],
  templateUrl: './bonos-section.html',
  styleUrl: './bonos-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BonosSection implements OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly timerId = window.setInterval(() => this.tickBonds(), 1000);
  private isSettlingBonds = false;

  protected readonly user = this.authService.user;
  protected readonly offers = signal<BondOffer[]>([]);
  protected readonly bonds = signal<BondItem[]>([]);
  protected readonly selectedTicker = signal('AMZN');
  protected readonly state = signal<ActionState>({
    errorMessage: '',
    status: 'loading',
    successMessage: '',
  });
  protected readonly selectedOffer = computed(() => {
    return this.offers().find((offer) => offer.ticker === this.selectedTicker()) ?? this.offers()[0];
  });
  protected readonly activeBonds = computed(() => this.bonds().filter((bond) => bond.status === 'active'));
  protected readonly settledBonds = computed(() => this.bonds().filter((bond) => bond.status === 'settled'));
  protected readonly bondForm = this.formBuilder.group({
    amount: ['1000', [Validators.required]],
  });

  constructor() {
    this.loadOffers();
    this.loadBonds();
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timerId);
  }

  protected selectOffer(ticker: string): void {
    this.selectedTicker.set(ticker);
    this.state.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected investBond(): void {
    const token = this.authService.idToken();
    const amount = Number(this.bondForm.controls.amount.value.trim().replace(',', '.'));
    const offer = this.selectedOffer();

    if (!token) {
      this.state.set({
        errorMessage: 'Debes iniciar sesion para contratar un bono.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    if (!offer || this.bondForm.invalid || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      this.bondForm.markAllAsTouched();
      this.state.set({
        errorMessage: 'Introduce una cantidad entre 0,01 y 100000.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.state.set({
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    });

    this.accountService
      .createBond(token, offer.ticker, amount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.bonds.update((items) => [response.bond, ...items]);
          this.bondForm.reset({ amount: '1000' });
          this.state.set({
            errorMessage: '',
            status: 'success',
            successMessage: `Bono de ${response.bond.name} contratado por ${this.formatNumber(response.bond.amount, 2)} $.`,
          });
        },
        error: (error: HttpErrorResponse) => {
          this.state.set({
            errorMessage: this.getErrorMessage(error, 'No se pudo contratar el bono.'),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  protected formatNumber(value: number | undefined, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value ?? 0);
  }

  protected formatTime(seconds: number): string {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  private loadOffers(): void {
    this.accountService
      .getBondOffers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.offers.set(response.items);

          if (response.items.length > 0 && !response.items.some((offer) => offer.ticker === this.selectedTicker())) {
            this.selectedTicker.set(response.items[0].ticker);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.state.set({
            errorMessage: this.getErrorMessage(error, 'No se pudieron cargar las ofertas de bonos.'),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  private loadBonds(): void {
    const token = this.authService.idToken();

    if (!token) {
      this.state.set({
        errorMessage: 'Debes iniciar sesion para ver tus bonos.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.accountService
      .getBonds(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.bonds.set(response.items);

          if (this.state().status === 'loading') {
            this.state.set({
              errorMessage: '',
              status: 'idle',
              successMessage: '',
            });
          }
        },
        error: (error: HttpErrorResponse) => {
          this.state.set({
            errorMessage: this.getErrorMessage(error, 'No se pudieron cargar tus bonos.'),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  private tickBonds(): void {
    const now = Date.now();
    let hasMaturedBond = false;

    this.bonds.update((items) => items.map((bond) => {
      if (bond.status !== 'active') {
        return bond;
      }

      const maturityTime = bond.maturityAt ? new Date(bond.maturityAt).getTime() : Number.NaN;
      const secondsRemaining = Number.isFinite(maturityTime)
        ? Math.max(0, Math.ceil((maturityTime - now) / 1000))
        : Math.max(0, bond.secondsRemaining - 1);

      if (secondsRemaining === 0) {
        hasMaturedBond = true;
      }

      return {
        ...bond,
        secondsRemaining,
      };
    }));

    if (hasMaturedBond) {
      this.settleMaturedBonds();
    }
  }

  private settleMaturedBonds(): void {
    const token = this.authService.idToken();

    if (!token || this.isSettlingBonds) {
      return;
    }

    this.isSettlingBonds = true;

    this.accountService
      .settleBonds(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isSettlingBonds = false;
          this.authService.updateUser(response.user);
          this.loadBonds();

          if (response.settledCount > 0) {
            this.state.set({
              errorMessage: '',
              status: 'success',
              successMessage: `${response.settledCount} bono${response.settledCount === 1 ? '' : 's'} liquidado${response.settledCount === 1 ? '' : 's'}.`,
            });
          }
        },
        error: () => {
          this.isSettlingBonds = false;
          this.loadBonds();
        },
      });
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    if (error.status === 0) {
      return 'No se puede conectar con el backend.';
    }

    return fallback;
  }
}
