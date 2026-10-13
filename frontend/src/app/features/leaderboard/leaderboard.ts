import {
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { Observable } from 'rxjs';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { LeaderboardEntryResponseDto } from '../../core/modules/openapi';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { BasePaginationComponent } from '../../shared/pagination/pagination-base';
import { PaginationControlsComponent } from '../../shared/pagination/pagination-controls';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-leaderboard',
  imports: [
    RouterLink,
    PaginationControlsComponent,
    MatCardModule,
    MatListModule,
    MatDividerModule,
    MatButtonModule,
  ],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css'
})
export class Leaderboard extends BasePaginationComponent<LeaderboardEntryResponseDto> implements OnInit {
  private readonly leaderboardService = inject(LeaderboardService);
  
  ngOnInit(): void {
    this.loadPage(this.currentPage());
  }

  protected fetchData(page: number, size: number): Observable<{ items: LeaderboardEntryResponseDto[]; total: number }> {
    return this.leaderboardService.getLeaderboardPage(page, size);
  }
}
