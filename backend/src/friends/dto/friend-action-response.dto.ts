import { ApiProperty } from '@nestjs/swagger';

export class FriendActionResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}