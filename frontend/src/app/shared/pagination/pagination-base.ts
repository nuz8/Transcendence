// Adapted from: https://dev.to/kedar7/simplifying-pagination-in-angular-with-a-reusable-base-component-12jc

import { signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Observable } from 'rxjs';

export abstract class BasePaginationComponent<T> {
  readonly data = signal<T[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly totalItems = signal(0);
  readonly isLoading = signal(false);

  // Abstract method to fetch data; must be implemented by subclasses
  protected abstract fetchData(page: number, size: number): Observable<{ items: T[]; total: number }>;

  // Method to load data for a specific page
  loadPage(page: number): void {
    this.isLoading.set(true);
    this.fetchData(page, this.pageSize())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe(response => {
        this.data.set(response.items);
        this.totalItems.set(response.total);
        this.currentPage.set(page);
      });
  }

  // Method to handle page change events (e.g., from a paginator component)
  onPageChange(page: number): void {
    this.loadPage(page);
  }
}
