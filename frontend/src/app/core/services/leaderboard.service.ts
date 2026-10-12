import { inject, Service } from '@angular/core';
import { GamificationService, LeaderboardEntryResponseDto } from '../modules/openapi';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Service()
export class LeaderboardService {
  private readonly gamificationService = inject(GamificationService);

  getLeaderboardPage(
    page: number,
    size: number,
  ): Observable<{ items: LeaderboardEntryResponseDto[]; total: number }> {
    return this.gamificationService
      .gamificationControllerGetLeaderboard({ page, limit: size })
      .pipe(map(response => ({ items: response.items, total: response.total })));
  }
}
