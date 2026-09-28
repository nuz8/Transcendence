import { ApiProperty } from '@nestjs/swagger';

export class PublicUserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier.',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({ example: 'player_one' })
  username!: string;

  @ApiProperty({
    example: 'player@example.com',
    format: 'email',
  })
  email!: string;

  @ApiProperty({
    description: 'Avatar URL or static path.',
    example: '/static/avatars/default.svg',
  })
  avatar!: string;
}