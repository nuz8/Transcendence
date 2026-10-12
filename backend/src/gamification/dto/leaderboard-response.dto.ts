import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryResponseDto {
  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  rank!: number;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'player_one' })
  username!: string;

  @ApiProperty({ example: 'api/static/avatars/default.svg' })
  avatar!: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 125 })
  xp!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 4 })
  level!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 42 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, example: 20 })
  limit!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 3 })
  totalPages!: number;

  @ApiProperty({ type: [LeaderboardEntryResponseDto] })
  items!: LeaderboardEntryResponseDto[];
}