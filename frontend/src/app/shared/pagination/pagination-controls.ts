// Adapted from: https://dev.to/kedar7/simplifying-pagination-in-angular-with-a-reusable-base-component-12jc

import { Component, input, output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

@Component({
  imports: [MatPaginatorModule],
  selector: 'app-pagination-controls',
  templateUrl: './pagination-controls.html',
  styles: `mat-paginator { background: transparent; }`,
})
export class PaginationControlsComponent {
  readonly currentPage = input(1);
  readonly totalItems = input(0);
  readonly pageSize = input(10);
  readonly pageChange = output<number>();

  onPage(event: PageEvent): void {
    this.pageChange.emit(event.pageIndex + 1);
  }
}
