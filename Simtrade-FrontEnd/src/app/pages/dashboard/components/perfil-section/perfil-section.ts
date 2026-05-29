import { isPlatformBrowser } from '@angular/common';
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
import { ArcElement, Chart, ChartConfiguration, DoughnutController, Legend, Tooltip } from 'chart.js';
import { getAssetName } from '../../../../services/assets';
import { AuthService } from '../../../../services/auth';
import { MarketService, PortfolioGains } from '../../../../services/market';
import { ThemeService } from '../../../../services/theme';

interface ProfilePosition {
  name: string;
  quantity: number;
  ticker: string;
}

interface CompositionItem extends ProfilePosition {
  percentage: number;
  value: number;
}

@Component({
  selector: 'app-perfil-section',
  templateUrl: './perfil-section.html',
  styleUrl: './perfil-section.css',
  host: {
    id: 'perfil',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilSection implements AfterViewInit, OnDestroy {
  @ViewChild('compositionCanvas') private readonly compositionCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly marketService = inject(MarketService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);
  private readonly chartReady = signal(false);
  private chart: Chart<'doughnut'> | null = null;

  protected readonly user = this.authService.user;
  protected readonly idToken = this.authService.idToken;
  protected readonly theme = this.themeService.theme;
  protected readonly portfolioGains = signal<PortfolioGains | null>(null);
  protected readonly assetCount = computed(() => Object.keys(this.user()?.cartera ?? {}).length);
  protected readonly profilePositions = computed<ProfilePosition[]>(() =>
    Object.entries(this.user()?.cartera ?? {})
      .map(([ticker, quantity]) => ({
        name: getAssetName(ticker),
        quantity,
        ticker,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
  protected readonly composition = computed<CompositionItem[]>(() => {
    const gains = this.portfolioGains();
    const positions = this.profilePositions();
    const totalValue = gains?.totalValue ?? 0;

    if (!gains || totalValue <= 0) {
      return [];
    }

    return positions
      .map((position) => ({
        ...position,
        value: gains.positions[position.ticker.toUpperCase()]?.totalValue ?? 0,
      }))
      .filter((position) => position.value > 0)
      .map((position) => ({
        ...position,
        percentage: (position.value / totalValue) * 100,
      }));
  });
  protected readonly themeLabel = computed(() => this.theme() === 'dark' ? 'Oscuro' : 'Claro');

  constructor() {
    Chart.register(ArcElement, DoughnutController, Legend, Tooltip);

    effect(() => {
      this.loadPortfolioGains(this.idToken(), this.profilePositions().length);
    });

    effect(() => {
      if (!this.chartReady()) {
        return;
      }

      this.theme();
      this.scheduleCompositionChartRender(this.composition());
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.chartReady.set(true);
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected formatNumber(value: number | undefined, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value ?? 0);
  }

  private loadPortfolioGains(token: string | null, positionCount: number): void {
    if (!token || positionCount === 0) {
      this.portfolioGains.set(null);
      return;
    }

    this.marketService
      .getPortfolioGains(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gains) => this.portfolioGains.set(gains),
        error: () => this.portfolioGains.set(null),
      });
  }

  private scheduleCompositionChartRender(items: CompositionItem[]): void {
    window.requestAnimationFrame(() => this.renderCompositionChart(items));
  }

  private renderCompositionChart(items: CompositionItem[]): void {
    const canvas = this.compositionCanvas?.nativeElement;

    if (!canvas || items.length === 0) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    const isDarkTheme = this.theme() === 'dark';
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: items.map((item) => item.name),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: ['#0284c7', '#0f766e', '#ea580c', '#9333ea', '#dc2626', '#ca8a04', '#4f46e5'],
            borderColor: isDarkTheme ? '#1a1d1f' : '#ffffff',
            borderWidth: 3,
          },
        ],
      },
      options: {
        animation: false,
        cutout: '58%',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: isDarkTheme ? '#1a1d1f' : '#ffffff',
            bodyColor: isDarkTheme ? '#f3f4f0' : '#111827',
            borderColor: isDarkTheme ? '#383f42' : '#e5e7eb',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const item = items[context.dataIndex];
                return `${item.name}: ${this.formatNumber(item.percentage, 2)}%`;
              },
            },
            titleColor: isDarkTheme ? '#f3f4f0' : '#111827',
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
