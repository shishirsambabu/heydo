import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DatabaseModule } from '../common/database/database.module';
import { AdminSessionService } from './admin-session.service';
import {
  ADMIN_SESSION_REPOSITORY,
  InMemoryAdminSessionRepository,
} from './admin-session.repository';
import { PostgresAdminSessionRepository } from './postgres-admin-session.repository';

/**
 * Shared security primitives (JWT + guards), importable by any feature module
 * without creating a cycle with AuthModule. AuthModule (which also issues
 * tokens) imports IdentityModule; feature modules import SecurityModule only.
 */
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
      }),
    }),
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    {
      provide: ADMIN_SESSION_REPOSITORY,
      inject: [ConfigService, PostgresAdminSessionRepository],
      useFactory: (config: ConfigService, postgres: PostgresAdminSessionRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryAdminSessionRepository(),
    },
    PostgresAdminSessionRepository,
    AdminSessionService,
  ],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, AdminSessionService],
})
export class SecurityModule {}
