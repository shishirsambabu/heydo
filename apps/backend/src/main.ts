import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS: the admin web (and Flutter web) call this API from a different origin.
  // Dev reflects the request origin; production pins an explicit allowlist.
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowed : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // NOTE: never log PII here. See .claude/rules/pii_and_privacy.md
  new Logger('Bootstrap').log(`Heydo backend (Phase 1) listening on :${port}`);
}

void bootstrap();
