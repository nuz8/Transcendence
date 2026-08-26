import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const httpsOptions = {
    key: readFileSync('./secrets/key.pem'),
    cert: readFileSync('./secrets/cert.pem'),
  };
  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>('PORT', 3000));
}
bootstrap();
