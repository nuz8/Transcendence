import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import db from './db/client';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { seedAchievements } from './gamification/seed-achievements';

async function bootstrap() {
  await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
  await seedAchievements(db); // Seed achievements catalog data into the achievements table

  const httpsOptions = {
    key: readFileSync('./certs/key.pem'),
    cert: readFileSync('./certs/cert.pem'),
  };
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });
  const configService = app.get(ConfigService);
  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Transcendence API')
    .setDescription('API documentation for the Transcendence backend')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/static/',
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  await app.listen(configService.get<number>('PORT', 3000));
}
bootstrap();
