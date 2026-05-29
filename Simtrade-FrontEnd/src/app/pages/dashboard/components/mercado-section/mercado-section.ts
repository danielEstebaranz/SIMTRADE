import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CategoryScale,
  Chart,
  ChartConfiguration,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { AuthService } from '../../../../services/auth';
import { MARKET_ASSETS, MarketAsset } from '../../../../services/assets';
import { MarketService, TrendPoint, TrendRange, TrendSource } from '../../../../services/market';
import { ThemeService } from '../../../../services/theme';

interface TrendState {
  errorMessage: string;
  points: TrendPoint[];
  source: TrendSource | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

interface TrendSummary {
  change: number;
  changePercent: number;
  isPositive: boolean;
  last: number;
  max: number;
  min: number;
}

interface BuyState {
  amount: string;
  errorMessage: string;
  status: 'idle' | 'saving' | 'success' | 'error';
  successMessage: string;
}

@Component({
  selector: 'app-mercado-section',
  templateUrl: './mercado-section.html',
  styleUrl: './mercado-section.css',
  host: {
    id: 'mercado',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercadoSection implements AfterViewInit, OnDestroy {
  @ViewChild('trendCanvas') private readonly trendCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly marketService = inject(MarketService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);
  private chart: Chart<'line'> | null = null;
  private readonly chartReady = signal(false);
  private requestId = 0;

  protected readonly idToken = this.authService.idToken;
  protected readonly assets = signal<MarketAsset[]>(MARKET_ASSETS);
  protected readonly selectedTicker = signal(MARKET_ASSETS[0].ticker);
  protected readonly selectedRange = signal<TrendRange>('1d');
  protected readonly buyDialogOpen = signal(false);
  protected readonly buyState = signal<BuyState>({
    amount: '',
    errorMessage: '',
    status: 'idle',
    successMessage: '',
  });
  protected readonly trendState = signal<TrendState>({
    errorMessage: '',
    points: [],
    source: null,
    status: 'idle',
  });
  protected readonly rangeOptions: { label: string; value: TrendRange }[] = [
    { label: '1 dia', value: '1d' },
    { label: '1 semana', value: '1w' },
    { label: '1 año', value: '1y' },
  ];
  protected readonly selectedAsset = computed(() => {
    const assets = this.assets();
    return assets.find((asset) => asset.ticker === this.selectedTicker()) ?? assets[0];
  });
  protected readonly trendSummary = computed<TrendSummary | null>(() => {
    const prices = this.trendState().points.map((point) => point.price);

    if (prices.length === 0) {
      return null;
    }

    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;

    return {
      change,
      changePercent: first === 0 ? 0 : (change / first) * 100,
      isPositive: change >= 0,
      last,
      max: Math.max(...prices),
      min: Math.min(...prices),
    };
  });

  constructor() {
    Chart.register(
      CategoryScale,
      Filler,
      Legend,
      LineController,
      LineElement,
      LinearScale,
      PointElement,
      Tooltip,
    );

    effect(() => {
      this.loadTrend(this.selectedTicker(), this.selectedRange());
    });

    this.loadAssets();

    effect(() => {
      if (!this.chartReady()) {
        return;
      }

      this.themeService.theme();
      this.scheduleChartRender(this.trendState().points, this.selectedTicker());
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.chartReady.set(true);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected selectAsset(ticker: string): void {
    this.selectedTicker.set(ticker);
  }

  protected selectRange(range: TrendRange): void {
    this.selectedRange.set(range);
  }

  protected openBuyDialog(): void {
    this.buyState.set({
      amount: '',
      errorMessage: '',
      status: 'idle',
      successMessage: '',
    });
    this.buyDialogOpen.set(true);
  }

  protected closeBuyDialog(): void {
    if (this.buyState().status === 'saving') {
      return;
    }

    this.buyDialogOpen.set(false);
  }

  protected updateBuyAmount(amount: string): void {
    this.buyState.update((state) => ({
      ...state,
      amount,
      errorMessage: '',
      status: state.status === 'success' ? 'idle' : state.status,
      successMessage: '',
    }));
  }

  protected updateBuyAmountFromEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.updateBuyAmount(input?.value ?? '');
  }

  protected buySelectedAsset(): void {
    const token = this.idToken();
    const amount = Number(this.buyState().amount.replace(',', '.'));
    const asset = this.selectedAsset();

    if (!asset) {
      this.buyState.update((state) => ({
        ...state,
        errorMessage: 'No hay activos disponibles para comprar.',
        status: 'error',
      }));
      return;
    }

    if (!token) {
      this.buyState.update((state) => ({
        ...state,
        errorMessage: 'Debes iniciar sesion para comprar.',
        status: 'error',
      }));
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      this.buyState.update((state) => ({
        ...state,
        errorMessage: 'Introduce un importe mayor que 0.',
        status: 'error',
      }));
      return;
    }

    this.buyState.update((state) => ({
      ...state,
      errorMessage: '',
      status: 'saving',
      successMessage: '',
    }));

    this.marketService
      .buyAsset(token, asset.ticker, amount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateUser(response.user);
          this.buyState.set({
            amount: '',
            errorMessage: '',
            status: 'success',
            successMessage: `Compra realizada por ${this.formatNumber(response.operation.total, 2)} $.`,
          });
        },
        error: (error: HttpErrorResponse) => {
          this.buyState.update((state) => ({
            ...state,
            errorMessage: this.getBuyErrorMessage(error),
            status: 'error',
          }));
        },
      });
  }

  protected formatNumber(value: number | undefined, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value ?? 0);
  }

  private getBuyErrorMessage(error: HttpErrorResponse): string {
    if (typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    if (error.status === 0) {
      return 'No se puede conectar con el backend.';
    }

    return 'No se pudo realizar la compra.';
  }

  private loadAssets(): void {
    this.marketService
      .getAssets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.items.length === 0) {
            return;
          }

          this.assets.set(response.items);

          if (!response.items.some((asset) => asset.ticker === this.selectedTicker())) {
            this.selectedTicker.set(response.items[0].ticker);
          }
        },
      });
  }

  private loadTrend(ticker: string, range: TrendRange): void {
    const requestId = this.requestId + 1;
    this.requestId = requestId;

    this.trendState.set({
      errorMessage: '',
      points: [],
      source: null,
      status: 'loading',
    });

    this.marketService
      .getTrend(ticker, range)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trend) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.trendState.set({
            errorMessage: '',
            points: trend.points,
            source: trend.source,
            status: 'loaded',
          });
        },
        error: () => {
          if (requestId !== this.requestId) {
            return;
          }

          this.trendState.set({
            errorMessage: 'No se pudo cargar la tendencia del activo.',
            points: [],
            source: null,
            status: 'error',
          });
        },
      });
  }

  private scheduleChartRender(points: TrendPoint[], ticker: string): void {
    window.requestAnimationFrame(() => this.renderChart(points, ticker));
  }

  private renderChart(points: TrendPoint[], ticker: string): void {
    const canvas = this.trendCanvas?.nativeElement;

    if (!canvas || points.length === 0) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    const labels = points.map((point) =>
      new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        hour: this.selectedRange() === '1y' ? undefined : '2-digit',
        month: 'short',
      }).format(new Date(point.timestamp * 1000)),
    );
    const values = points.map((point) => point.price);
    const lineColor = values.at(-1)! >= values[0] ? '#047857' : '#b91c1c';
    const isDarkTheme = this.themeService.theme() === 'dark';
    const axisColor = isDarkTheme ? '#c2c7c4' : '#4b5563';
    const gridColor = isDarkTheme ? '#383f42' : '#e5e7eb';
    const fillColor = isDarkTheme ? 'rgba(15, 159, 154, 0.16)' : 'rgba(2, 132, 199, 0.12)';
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: ticker,
            data: values,
            borderColor: lineColor,
            backgroundColor: fillColor,
            borderWidth: 3,
            fill: true,
            pointRadius: 0,
            tension: 0.32,
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: isDarkTheme ? '#1a1d1f' : '#ffffff',
            bodyColor: isDarkTheme ? '#f3f4f0' : '#111827',
            borderColor: gridColor,
            borderWidth: 1,
            intersect: false,
            mode: 'index',
            titleColor: isDarkTheme ? '#f3f4f0' : '#111827',
          },
        },
        scales: {
          x: {
            border: {
              color: gridColor,
            },
            grid: {
              display: false,
            },
            ticks: {
              color: axisColor,
              maxTicksLimit: 6,
            },
          },
          y: {
            beginAtZero: false,
            border: {
              color: gridColor,
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: axisColor,
              callback: (value) => `${this.formatNumber(Number(value), 2)} $`,
            },
          },
        },
      },
    };

    if (this.chart) {
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.chart.update();
      return;
    }

    this.chart = new Chart(canvas, config);
  }
}
