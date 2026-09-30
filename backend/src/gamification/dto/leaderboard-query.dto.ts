import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class LeaderboardQueryDto {
	@ApiPropertyOptional({
		description: 'Page of leaderboard results.',
		type: Number,
		default: 1,
		minimum: 1,
		maximum: Number.MAX_SAFE_INTEGER,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(Number.MAX_SAFE_INTEGER)
	page: number = 1;

	@ApiPropertyOptional({
		description: 'Number of leaderboard entries per page',
		type: Number,
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit: number = 20;
}