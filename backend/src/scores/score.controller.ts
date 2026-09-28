import { Controller, Get, Req, UseGuards, Query, } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ScoreService } from './score.service';
import { MatchHistoryQueryDto } from './dto/mh-query.dto';
import { UserStatsResponseDto } from './dto/user-stats-response.dto';
import { ApiScoresController, ApiUsersSelfMatches, ApiUsersSelfStats } from './score-api.decorators';
import { MatchHistoryResponseDto } from './dto/mh-response.dto';

@ApiScoresController()
@Controller('users/self')
@UseGuards(AuthGuard)
export class ScoreController {
    constructor(private readonly scoreService: ScoreService){}

    @Get('matches')
    @ApiUsersSelfMatches()
    async listMatches(
        @Req() req: { user: { sub: string }},
        @Query() query: MatchHistoryQueryDto,
    ): Promise<MatchHistoryResponseDto> {
        const { matches, total } = await this.scoreService.listForUser(req.user.sub, query.page, query.limit);

        return {
            total,
            page: query.page,
            limit: query.limit,
            items: matches.map((match) => ({
                gameId: match.gameId,
                gameName: match.gameName,
                outcome: match.outcome,
                value: match.value,
                achievedAt: match.achievedAt,
            })),
        };
    }

    @Get('stats')
    @ApiUsersSelfStats()
    async getStats(
        @Req() req: { user: { sub: string } }
    ): Promise<UserStatsResponseDto> {
        return this.scoreService.statsFor(req.user.sub);
    }
}
