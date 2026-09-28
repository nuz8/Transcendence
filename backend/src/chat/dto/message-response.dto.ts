import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  senderId!: string;

  @ApiProperty({ format: 'uuid' })
  receiverId!: string;

  @ApiProperty({ example: 'Hi there!' })
  content!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}