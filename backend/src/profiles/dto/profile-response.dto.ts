import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FRIENDSHIP_STATES, type FriendshipState } from "../../friends";
import { UserAchievementsResponseDto } from "../../gamification/dto/user-achievements-response.dto";
import { MatchHistoryResponseDto } from "../../scores/dto/mh-response.dto";
import { UserStatsResponseDto } from "../../scores/dto/user-stats-response.dto";


export class ProfileFriendshipResponseDto {
  @ApiProperty({ enum: [...FRIENDSHIP_STATES], example: 'friends' })
  state!: FriendshipState;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Friendship row id, null when state is self or none.',
  })
  friendshipId!: string | null;
}

export class ProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'player_one' })
  username!: string;

  @ApiProperty({ example: 'api/static/avatars/default.svg' })
  avatar!: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 120 })
  xp!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 10 })
  level!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 3 })
  globalRank!: number;

  @ApiProperty({ type: ProfileFriendshipResponseDto })
  friendship!: ProfileFriendshipResponseDto;

  @ApiPropertyOptional({
    description: 'Present only when the caller is the user or a friend of the user.',
  })
  online?: boolean;

  @ApiProperty({ type: UserAchievementsResponseDto })
  achievements!: UserAchievementsResponseDto;

  @ApiProperty({ type: UserStatsResponseDto })
  userStats!: UserStatsResponseDto;
  
  @ApiProperty({ type: MatchHistoryResponseDto })
  matchHistory!: MatchHistoryResponseDto;
}

export class SelfProfileResponseDto extends ProfileResponseDto {
  @ApiProperty({ format: 'email', example: 'player@example.com'})
  email!: string;
}