import { ApiProperty } from '@nestjs/swagger';
import type { FriendshipStatus } from '../friend.entity';

export class FriendSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'player_two' })
  username!: string;

  @ApiProperty({ example: '/static/avatars/default.svg' })
  avatar!: string;
}

export class AcceptedFriendResponseDto {
  @ApiProperty({ format: 'uuid' })
  friendshipId!: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'declined'] })
  status!: FriendshipStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: FriendSummaryResponseDto })
  friend!: FriendSummaryResponseDto;
}