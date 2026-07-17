import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { VerificationModule } from './verification/verification.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { NotificationModule } from './notifications/notification.module';

/**
 * Root module — Phase 1 (Identity Loop / VKYC).
 * CommonModule (global) provides the PII vault + audit log.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', 'apps/backend/.env.local', 'apps/backend/.env'],
    }),
    CommonModule,
    AuthModule,
    IdentityModule,
    VerificationModule,
    NotificationModule,
    MarketplaceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
