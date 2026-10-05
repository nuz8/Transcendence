import { ApiProperty } from '@nestjs/swagger';
import { MATCH_OUTCOMES, type MatchOutcome } from '../score.constants';

export class MatchOpponentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string | null;

  @ApiProperty({ example: 'player_two' })
  username!: string;

  @ApiProperty({ example: '/static/avatars/default.svg' })
  avatar!: string;

  @ApiProperty({
    example: false,
    description: 'True of the opponent account has been soft-deleted.'
  })
  isDeleted!: boolean;
}

export class MatchHistoryItemResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Identifier of the match session.' })
  sessionId!: string;

  @ApiProperty({ description: 'Identifier of the game.' })
  gameId!: string;

  @ApiProperty({ example: 'Rock Paper Scissors' })
  gameName!: string;

  @ApiProperty({ enum: [...MATCH_OUTCOMES], example: 'win' })
  outcome!: MatchOutcome;

  @ApiProperty({ type: 'integer', example: 3 })
  value!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-24T12:00:00.000Z',
  })
  achievedAt!: Date;

  @ApiProperty({ type: MatchOpponentResponseDto, nullable: true })
  opponent!: MatchOpponentResponseDto | null;
}

export class MatchHistoryResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 42 })
  total!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, example: 10 })
  limit!: number;

  @ApiProperty({ type: [MatchHistoryItemResponseDto] })
  items!: MatchHistoryItemResponseDto[];
}