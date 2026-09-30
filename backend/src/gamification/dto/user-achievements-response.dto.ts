import { ApiProperty } from '@nestjs/swagger';

export class AchievementItemResponseDto {
  @ApiProperty({ example: 'WIN_1' })
  id!: string;

  @ApiProperty({ example: 'First Blood' })
  title!: string;

  @ApiProperty({ example: 'Win your first game' })
  description!: string;

  @ApiProperty({ example: '/static/badges/svg/win-1.svg' })
  badgeUrl!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  targetWins!: number;

  @ApiProperty({ example: true })
  unlocked!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  unlockedAt!: Date | null;
}

export class UserAchievementsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 12 })
  totalWins!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 3 })
  unlockedCount!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    nullable: true,
    example: 16,
  })
  nextMilestoneWins!: number | null;

  @ApiProperty({ type: [AchievementItemResponseDto] })
  achievements!: AchievementItemResponseDto[];
}