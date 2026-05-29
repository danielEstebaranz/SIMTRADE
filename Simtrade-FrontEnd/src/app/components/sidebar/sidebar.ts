import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

interface SidebarItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly router = inject(Router);

  protected readonly activePath = signal(this.getActivePath());
  protected readonly menuItems = signal<SidebarItem[]>([
    { label: 'Cartera', path: 'cartera', icon: 'CA' },
    { label: 'Mercado', path: 'mercado', icon: 'ME' },
    { label: 'Bonos', path: 'bonos', icon: 'BO' },
    { label: 'Historial', path: 'historial', icon: 'HI' },
    { label: 'Estadisticas', path: 'estadisticas', icon: 'ES' },
    { label: 'Configuracion', path: 'configuracion', icon: 'CO' },
  ]);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activePath.set(this.getActivePath()));
  }

  private getActivePath(): string {
    const primaryRoute = this.router.parseUrl(this.router.url).root.children['primary'];
    return primaryRoute?.segments[1]?.path ?? 'cartera';
  }
}
