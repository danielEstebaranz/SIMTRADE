import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../services/auth';
import { HistoryItem, MarketService } from '../../../../services/market';

interface HistoryState {
  errorMessage: string;
  items: HistoryItem[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

@Component({
  selector: 'app-historial-section',
  template: `
    <section class="history-card" aria-labelledby="history-title">
      <div class="section-heading">
        <p class="eyebrow">Historial</p>
        <h2 id="history-title">Ultimas notificaciones</h2>
      </div>

      @if (historyState().status === 'loading') {
        <p class="state-message" role="status">Cargando historial...</p>
      } @else if (historyState().status === 'error') {
        <p class="state-message error" role="alert">{{ historyState().errorMessage }}</p>
      } @else if (notifications().length > 0) {
        <ol class="history-list" aria-label="Ultimos movimientos de la cuenta">
          @for (item of notifications(); track item.id) {
            <li class="history-item">
              <span
                class="operation-badge"
                [class.sale]="item.type === 'venta'"
                [class.deposit]="item.type === 'deposito'"
                [class.withdrawal]="item.type === 'retirada'"
                [class.reset]="item.type === 'reinicio'"
                [class.bond]="item.type === 'bono_inversion' || item.type === 'bono_cierre'"
              >
                {{ getOperationLabel(item) }}
              </span>

              <div class="history-content">
                <strong>{{ buildMessage(item) }}</strong>
                <span>{{ formatDate(item.date) }}</span>
              </div>
            </li>
          }
        </ol>
      } @else {
        <p class="state-message">Todavia no hay movimientos en tu cuenta.</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      scroll-margin-top: 1rem;
    }

    .history-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1.25rem;
    }

    .section-heading {
      margin-bottom: 1rem;
    }

    .eyebrow {
      color: #0369a1;
      font-size: 0.85rem;
      font-weight: 700;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }

    h2 {
      color: #111827;
      font-size: 1.2rem;
      margin: 0;
    }

    .history-list {
      display: grid;
      gap: 0.75rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .history-item {
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      display: flex;
      gap: 0.85rem;
      padding: 0.9rem;
    }

    .operation-badge {
      background: #dcfce7;
      border-radius: 999px;
      color: #166534;
      flex: 0 0 auto;
      font-size: 0.85rem;
      font-weight: 800;
      padding: 0.35rem 0.7rem;
    }

    .operation-badge.sale {
      background: #fee2e2;
      color: #991b1b;
    }

    .operation-badge.deposit {
      background: #e0f2fe;
      color: #075985;
    }

    .operation-badge.withdrawal {
      background: #ffedd5;
      color: #9a3412;
    }

    .operation-badge.reset {
      background: #fef3c7;
      color: #92400e;
    }

    .operation-badge.bond {
      background: #e0f2fe;
      color: #0369a1;
    }

    .history-content {
      display: grid;
      gap: 0.25rem;
    }

    .history-content strong {
      color: #111827;
      font-size: 1rem;
    }

    .history-content span,
    .state-message {
      color: #4b5563;
    }

    .state-message {
      margin: 0;
    }

    .state-message.error {
      background: #fee2e2;
      border-radius: 0.5rem;
      color: #7f1d1d;
      padding: 0.75rem;
    }

    @media (max-width: 640px) {
      .history-item {
        align-items: start;
        flex-direction: column;
      }
    }
  `,
  host: {
    id: 'historial',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialSection {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly marketService = inject(MarketService);

  protected readonly historyState = signal<HistoryState>({
    errorMessage: '',
    items: [],
    status: 'idle',
  });
  protected readonly notifications = computed(() =>
    this.historyState().items.filter((item) => item.type !== 'dividendo_reinvertido'),
  );

  constructor() {
    const token = this.authService.idToken();

    if (!token) {
      this.historyState.set({
        errorMessage: 'Debes iniciar sesion para ver el historial.',
        items: [],
        status: 'error',
      });
      return;
    }

    this.loadHistory(token);
  }

  protected buildMessage(item: HistoryItem): string {
    if (item.type === 'deposito') {
      return `Has añadido ${this.formatNumber(item.total, 2)} $ al saldo.`;
    }

    if (item.type === 'retirada') {
      return `Has retirado ${this.formatNumber(item.total, 2)} $ del saldo.`;
    }

    if (item.type === 'reinicio') {
      return 'Has reiniciado la cartera y el saldo vuelve a 1000 $.';
    }

    if (item.type === 'bono_inversion') {
      return `Has invertido ${this.formatNumber(item.total, 2)} $ en un bono de ${item.ticker}.`;
    }

    if (item.type === 'bono_cierre') {
      return `Ha finalizado tu bono de ${item.ticker} y has recibido ${this.formatNumber(item.total, 2)} $.`;
    }

    const verb = item.type === 'venta' ? 'Has vendido' : 'Has comprado';
    return `${verb} ${this.formatNumber(item.quantity, 4)} acciones de ${item.ticker} a ${this.formatNumber(item.price, 2)} $ por ${this.formatNumber(item.total, 2)} $.`;
  }

  protected getOperationLabel(item: HistoryItem): string {
    if (item.type === 'deposito') {
      return 'Deposito';
    }

    if (item.type === 'retirada') {
      return 'Retirada';
    }

    if (item.type === 'reinicio') {
      return 'Reinicio';
    }

    if (item.type === 'bono_inversion') {
      return 'Bono';
    }

    if (item.type === 'bono_cierre') {
      return 'Cobro';
    }

    return item.type === 'venta' ? 'Venta' : 'Compra';
  }

  protected formatDate(date: string | null): string {
    if (!date) {
      return 'Fecha pendiente';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  protected formatNumber(value: number, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  private loadHistory(token: string): void {
    this.historyState.set({
      errorMessage: '',
      items: [],
      status: 'loading',
    });

    this.marketService
      .getHistory(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.historyState.set({
            errorMessage: '',
            items: response.items,
            status: 'loaded',
          });
        },
        error: () => {
          this.historyState.set({
            errorMessage: 'No se pudo cargar el historial.',
            items: [],
            status: 'error',
          });
        },
      });
  }
}
