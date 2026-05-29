import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MarketPerformance,
  MarketService,
  MarketStatisticsResponse,
} from '../../../../services/market';

interface StatisticsState {
  data: MarketStatisticsResponse | null;
  errorMessage: string;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

@Component({
  selector: 'app-estadisticas-section',
  templateUrl: './estadisticas-section.html',
  styleUrl: './estadisticas-section.css',
  host: {
    id: 'estadisticas',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadisticasSection {
  private readonly destroyRef = inject(DestroyRef);
  private readonly marketService = inject(MarketService);

  protected readonly state = signal<StatisticsState>({
    data: null,
    errorMessage: '',
    status: 'idle',
  });

  constructor() {
    this.loadStatistics();
  }

  protected formatMoney(value: number): string {
    return `${this.formatNumber(value, 2)} $`;
  }

  protected signedPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatNumber(value, 2)}%`;
  }

  protected signedMoney(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatNumber(value, 2)} $`;
  }

  protected isPositive(item: MarketPerformance): boolean {
    return item.changePercent >= 0;
  }

  private formatNumber(value: number, maximumFractionDigits: number): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  private loadStatistics(): void {
    this.state.set({
      data: null,
      errorMessage: '',
      status: 'loading',
    });

    this.marketService
      .getStatistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.state.set({
            data,
            errorMessage: '',
            status: 'loaded',
          });
        },
        error: () => {
          this.state.set({
            data: null,
            errorMessage: 'No se pudieron cargar las estadisticas de mercado.',
            status: 'error',
          });
        },
      });
  }
}
