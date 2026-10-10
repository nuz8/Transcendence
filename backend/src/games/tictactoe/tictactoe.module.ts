import { Module, OnModuleInit } from "@nestjs/common";
import { AuthModule } from "../../auth";
import { ScoreModule } from "../../scores";
import { GameModule } from "../game.module";
import { GamificationModule } from "../../gamification";
import { PresenceModule } from "../../presence";
import { TicTacToeService } from "./tictactoe.service";
import { TicTacToeGateway } from "./tictactoe.gateway";
import { GameService } from "../game.service";
import { TTT_GAME_ID, TTT_GAME_NAME } from "./tictactoe.constants";

@Module({
	imports: [AuthModule, ScoreModule, GameModule, GamificationModule, PresenceModule],
	providers: [TicTacToeService, TicTacToeGateway],
})
export class TicTacToeModule implements OnModuleInit {
	constructor(private readonly gameService: GameService) {}

	// Ensures the games-table row exists so scores and settings can reference it (no migration needed)
	async onModuleInit(): Promise<void> {
		await this.gameService.ensureExists(TTT_GAME_ID, TTT_GAME_NAME);
	}
}