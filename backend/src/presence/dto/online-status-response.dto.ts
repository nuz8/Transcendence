import { ApiProperty } from "@nestjs/swagger";

export class OnlineStatusResponseDto {
  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Whether the target user currently has an active connection',
  })
  online!: boolean;
}