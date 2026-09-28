import { ApiProperty } from "@nestjs/swagger";

export class GameResponseDto {
  @ApiProperty({ description: 'Unique game identifier.', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Name of the game.', example: 'Rock Paper Scissors' })
  name!: string;
}