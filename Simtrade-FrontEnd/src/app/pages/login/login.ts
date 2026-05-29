import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<AuthMode>('login');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly title = computed(() =>
    this.mode() === 'login' ? 'Inicia sesion' : 'Crea tu cuenta',
  );
  protected readonly submitLabel = computed(() =>
    this.mode() === 'login' ? 'Entrar' : 'Registrar',
  );

  protected readonly form = this.formBuilder.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set('');
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const request =
      this.mode() === 'login'
        ? this.authService.login(this.form.getRawValue())
        : this.authService.register(this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.isLoading.set(false);
        void this.router.navigateByUrl('/panel/cartera');
      },
      error: (message: string) => {
        this.isLoading.set(false);
        this.errorMessage.set(message);
      },
    });
  }
}
