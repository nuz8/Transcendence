import { ApiProperty } from '@nestjs/swagger';
import { MATCH_OUTCOMES, type MatchOutcome } from '../score.constants';

export class MatchHistoryItemResponseDto {
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