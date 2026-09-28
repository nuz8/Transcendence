import { ApiProperty } from "@nestjs/swagger";

export class GameStatsResponseDto {
  @ApiProperty({ description: 'Game identifier.', format: 'uuid' })
  gameId!: string;

  @ApiProperty({ description: 'Game name.', example: 'Rock Paper Scissors' })
  gameName!: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 5 })
  played!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 3 })
  wins!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 1 })
  losses!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 1 })
  draws!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 0 })
  forfeits!: number;
}

export class UserStatsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 5 })
  played!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 3 })
  wins!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 1 })
  losses!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 1 })
  draws!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 0 })
  forfeits!: number;

  @ApiProperty({ type: [GameStatsResponseDto] })
  games!: GameStatsResponseDto[];
}