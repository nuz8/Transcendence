import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyResponseDto {
    @ApiProperty({ format: 'uuid' })
    id!: string;

    @ApiProperty({ example: 'tk_aB3dE', description: 'First characters of the key, to tell keys apart.' })
    prefix!: string;

    @ApiProperty({ type: String, format: 'date-time' })
    createdAt!: Date;
}

export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
    @ApiProperty({ description: 'The full key. It is shown only once, so store it now.' })
    key!: string;
}
