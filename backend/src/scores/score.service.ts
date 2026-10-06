import { Injectable } from "@nestjs/common";
import { ScoreEntity } from "./score.entity";
import { ScoreRepository } from "./score.repository";
import { GameService } from "../games";
import { MatchHistoryQueryDto } from "./dto/mh-query.dto";
import { MatchOutcome, XP_BY_OUTCOME } from "./score.constants";

export type MatchOpponent = {
    id: string | null;
    username: string;
    avatar: string;
    isDeleted: boolean;
}

export type MatchHistoryEntry = {
    sessionId: string;
    gameId: string;
    gameName: string;
    outcome: MatchOutcome;
    value: number;
    achievedAt: Date;
    opponent: MatchOpponent | null;
};

export type Stats = {
    played: number;
    wins: number;
    losses: number;
    draws: number;
    forfeits: number;
};

export type GameStats = Stats & { gameId: string, gameName: string };
export type UserStats = Stats & { games: GameStats[] };

const OUTCOME_FIELD = {
    win: 'wins',
    lose: 'losses',
    draw: 'draws',
    forfeit: 'forfeits',
} as const satisfies Record<MatchOutcome, keyof Stats>;

const emptyStats = (): Stats => ({ played: 0, wins: 0, losses: 0, draws: 0, forfeits: 0 });

@Injectable()
export class ScoreService {
    constructor(
        private readonly scoreRepository: ScoreRepository,
        private readonly gameService: GameService,
    ) {}

    recordMatch(scores: ScoreEntity[]): Promise<void> {
        return this.scoreRepository.recordMatch(scores.map((score) => ({
            score,
            xp: score.opponentId ? XP_BY_OUTCOME[score.outcome] : 0,
        })));
    }

    async listForUser(userId: string, page: number, limit: number): Promise<{ matches: MatchHistoryEntry[]; total: number }> {
        const [rows, total, games] = await Promise.all([
            this.scoreRepository.findByUser(userId, limit, (page - 1) * limit),
            this.scoreRepository.countByUser(userId),
            this.gameService.listGames(),
        ]);

        const nameById = new Map(games.map((game) => [game.id, game.name]));

        const matches = rows.map(({ score, opponent }) => ({
            sessionId: score.sessionId,
            gameId: score.gameId,
            gameName: nameById.get(score.gameId) ?? 'Unknown game',
            outcome: score.outcome,
            value: score.value,
            achievedAt: score.achievedAt,
            opponent,
        }));
        return { matches, total };
    }

    async statsFor(userId: string): Promise<UserStats> {
        const [counts, allGames] = await Promise.all([this.scoreRepository.countByGame(userId), this.gameService.listGames()]);
        const namebyId = new Map(allGames.map((game) => [game.id, game.name]));
        const byGame = new Map<string, Stats>();

        for (const row of counts) {
            const stats = byGame.get(row.gameId) ?? emptyStats();

            stats.played += row.total;
            stats[OUTCOME_FIELD[row.outcome]] += row.total;
            byGame.set(row.gameId, stats);
        }

        const games = [...byGame.entries()]
            .map(([gameId, stats]) => ({ gameId, gameName: namebyId.get(gameId) ?? 'Unknown game', ...stats }))
            .sort((a, b) => b.played - a.played || a.gameId.localeCompare(b.gameId));

        const total = games.reduce((sum, game) => {
            sum.played += game.played;
            sum.wins += game.wins;
            sum.losses += game.losses;
            sum.draws += game.draws;
            sum.forfeits += game.forfeits;
            return sum;
        }, emptyStats());

        return { ...total, games };
    }
}