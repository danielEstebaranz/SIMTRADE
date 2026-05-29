import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService } from '../../../../services/account';
import { AuthService } from '../../../../services/auth';
import { AppTheme, ThemeService } from '../../../../services/theme';

interface ActionState {
  errorMessage: string;
  status: 'idle' | 'loading' | 'saving' | 'success' | 'error';
  successMessage: string;
}

type SettingsPanel = 'appearance' | 'funds' | 'danger';
type FundsAction = 'add' | 'withdraw';

@Component({
  selector: 'app-configuracion-section',
  imports: [ReactiveFormsModule],
  templateUrl: './configuracion-section.html',
  styleUrl: './configuracion-section.css',
  host: {
    id: 'configuracion',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionSection {
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  protected readonly user = this.authService.user;
  protected readonly theme = this.themeService.theme;
  protected readonly activePanel = signal<SettingsPanel>('appearance');
  protected readonly fundsAction = signal<FundsAction>('add');
  protected readonly themeOptions: { label: string; value: AppTheme }[] = [
    { label: 'Claro', value: 'light' },
    { label: 'Oscuro', value: 'dark' },
  ];
  protected readonly panelOptions: { danger?: boolean; label: string; value: SettingsPanel }[] = [
    { label: 'Apariencia', value: 'appearance' },
    { label: 'Fondos', value: 'funds' },
    { danger: true, label: 'Borrar cuenta', value: 'danger' },
  ];
  protected readonly quickFundAmounts = [100, 500, 1000];
  protected readonly deleteConfirmation = signal('');
  protected readonly deleteDialogOpen = signal(false);
  protected readonly deletePassword = signal('');
  protected readonly resetConfirmation = signal('');
  protected readonly resetDialogOpen = signal(false);
  protected readonly resetPassword = signal('');
  protected readonly canDeleteAccount = computed(() => {
    return this.deleteConfirmation().trim() === 'BORRAR';
  });
  protected readonly canResetPortfolio = computed(() => {
    return this.resetConfirmation().trim() === 'REINICIAR';
  });
  protected readonly settingsState = signal<ActionState>({
    errorMessage: '',
    status: 'idle',
    successMessage: '',
  });
  protected readonly fundsState = signal<ActionState>({
    errorMessage: '',
    status: 'idle',
    successMessage: '',
  });
  protected readonly resetState = signal<ActionState>({
    errorMessage: '',
    status: 'idle',
    successMessage: '',
  });
  protected readonly deleteState = signal<ActionState>({
    errorMessage: '',
    status: 'idle',
    successMessage: '',
  });
  protected readonly fundsForm = this.formBuilder.group({
    amount: ['', [Validators.required]],
  });

  constructor() {
    this.loadSettings();
  }

  protected selectTheme(theme: AppTheme): void {
    const token = this.authService.idToken();
    const previousTheme = this.theme();

    this.themeService.setTheme(theme);

    if (!token) {
      this.themeService.setTheme(previousTheme);
      this.settingsState.set({
        errorMessage: 'Debes iniciar sesion para guardar el tema.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.settingsState.set({
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    });

    this.accountService
      .updateSettings(token, theme)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.settingsState.set({
            errorMessage: '',
            status: 'success',
            successMessage: 'Tema actualizado.',
          });
        },
        error: (error: HttpErrorResponse) => {
          this.themeService.setTheme(previousTheme);
          this.settingsState.set({
            errorMessage: this.getErrorMessage(error, 'No se pudo guardar el tema.'),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  protected selectPanel(panel: SettingsPanel): void {
    this.activePanel.set(panel);
  }

  protected selectFundsAction(action: FundsAction): void {
    this.fundsAction.set(action);
    this.fundsState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected setQuickFundAmount(amount: number): void {
    this.fundsForm.controls.amount.setValue(String(amount));
    this.fundsState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected addFunds(): void {
    this.saveFunds('add');
  }

  protected withdrawFunds(): void {
    this.saveFunds('withdraw');
  }

  protected updateResetConfirmationFromEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.resetConfirmation.set(input?.value ?? '');
    this.resetState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected openResetDialog(): void {
    if (!this.canResetPortfolio()) {
      this.resetState.set({
        errorMessage: 'Escribe REINICIAR en mayusculas para confirmar.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.resetPassword.set('');
    this.resetDialogOpen.set(true);
    this.resetState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected closeResetDialog(): void {
    if (this.resetState().status === 'saving') {
      return;
    }

    this.resetDialogOpen.set(false);
    this.resetPassword.set('');
  }

  protected updateResetPasswordFromEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.resetPassword.set(input?.value ?? '');
    this.resetState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected confirmResetPortfolio(): void {
    const token = this.authService.idToken();
    const password = this.resetPassword();

    if (!token) {
      this.resetState.set({
        errorMessage: 'Debes iniciar sesion para reiniciar la cartera.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    if (!password) {
      this.resetState.set({
        errorMessage: 'Introduce la contraseña de la cuenta.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.resetState.set({
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    });

    this.accountService
      .resetPortfolio(token, this.resetConfirmation(), password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.resetConfirmation.set('');
          this.resetPassword.set('');
          this.resetDialogOpen.set(false);
          this.resetState.set({
            errorMessage: '',
            status: 'success',
            successMessage: 'Cartera reiniciada correctamente.',
          });
        },
        error: (error: HttpErrorResponse) => {
          this.resetState.set({
            errorMessage: this.getErrorMessage(error, 'No se pudo reiniciar la cartera.'),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  private saveFunds(action: FundsAction): void {
    const token = this.authService.idToken();
    const amountValue = this.fundsForm.controls.amount.value.trim();
    const amount = Number(amountValue.replace(',', '.'));

    if (!token) {
      this.fundsState.set({
        errorMessage: `Debes iniciar sesion para ${action === 'add' ? 'añadir' : 'quitar'} fondos.`,
        status: 'error',
        successMessage: '',
      });
      return;
    }

    if (this.fundsForm.invalid || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      this.fundsForm.markAllAsTouched();
      this.fundsState.set({
        errorMessage: 'Introduce una cantidad entre 0,01 y 100000.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.fundsState.set({
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    });

    const request = action === 'add'
      ? this.accountService.addFunds(token, amount)
      : this.accountService.withdrawFunds(token, amount);

    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.fundsForm.reset();
          this.fundsState.set({
            errorMessage: '',
            status: 'success',
            successMessage: action === 'add'
              ? `Fondos añadidos: ${this.formatNumber(response.operation.amount, 2)} $.`
              : `Fondos retirados: ${this.formatNumber(response.operation.amount, 2)} $.`,
          });
        },
        error: (error: HttpErrorResponse) => {
          this.fundsState.set({
            errorMessage: this.getErrorMessage(
              error,
              action === 'add' ? 'No se pudieron añadir fondos.' : 'No se pudieron quitar fondos.',
            ),
            status: 'error',
            successMessage: '',
          });
        },
      });
  }

  protected updateDeleteConfirmationFromEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.deleteConfirmation.set(input?.value ?? '');
    this.deleteState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected deleteAccount(): void {
    if (!this.canDeleteAccount()) {
      this.deleteState.set({
        errorMessage: 'Escribe BORRAR en mayusculas para confirmar.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.deletePassword.set('');
    this.deleteDialogOpen.set(true);
    this.deleteState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected closeDeleteDialog(): void {
    if (this.deleteState().status === 'saving') {
      return;
    }

    this.deleteDialogOpen.set(false);
    this.deletePassword.set('');
  }

  protected updateDeletePasswordFromEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.deletePassword.set(input?.value ?? '');
    this.deleteState.set({
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
  }

  protected confirmDeleteAccount(): void {
    const token = this.authService.idToken();
    const password = this.deletePassword();

    if (!token) {
      this.deleteState.set({
        errorMessage: 'Debes iniciar sesion para borrar la cuenta.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    if (!password) {
      this.deleteState.set({
        errorMessage: 'Introduce la contraseña de la cuenta.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.deleteState.set({
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    });

    this.accountService
      .deleteAccount(token, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.authService.logout();
          void this.router.navigateByUrl('/login');
        },
        error: (error: HttpErrorResponse) => {
          this.deleteState.set({
            errorMessage: this.getErrorMessage(error, 'No se pudo borrar la cuenta.'),
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

  private loadSettings(): void {
    const token = this.authService.idToken();

    if (!token) {
      this.settingsState.set({
        errorMessage: 'Debes iniciar sesion para cargar la configuracion.',
        status: 'error',
        successMessage: '',
      });
      return;
    }

    this.settingsState.set({
      errorMessage: '',
      status: 'loading',
      successMessage: '',
    });

    this.accountService
      .getSettings(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.themeService.setTheme(response.settings.theme);
          this.settingsState.set({
            errorMessage: '',
            status: 'success',
            successMessage: '',
          });
        },
        error: (error: HttpErrorResponse) => {
          this.settingsState.set({
            errorMessage: this.getErrorMessage(error, 'No se pudo cargar la configuracion.'),
            status: 'error',
            successMessage: '',
          });
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
