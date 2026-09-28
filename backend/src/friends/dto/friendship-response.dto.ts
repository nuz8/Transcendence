import { ApiProperty } from '@nestjs/swagger';
import type { FriendshipStatus } from '../friend.entity';

export class FriendshipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  requesterId!: string;

  @ApiProperty({ format: 'uuid' })
  addresseeId!: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'declined'] })
  status!: FriendshipStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  respondedAt!: Date | null;
}