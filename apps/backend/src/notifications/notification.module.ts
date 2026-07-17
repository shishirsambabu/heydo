import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { DatabaseModule } from '../common/database/database.module';
import { NotificationController } from './notification.controller';
import {
  InMemoryNotificationRepository,
  NOTIFICATION_REPOSITORY,
} from './notification.repository';
import { NotificationService } from './notification.service';
import { PostgresNotificationRepository } from './postgres-notification.repository';

@Module({
  imports: [SecurityModule, DatabaseModule],
  controllers: [NotificationController],
  providers: [
    {
      provide: NOTIFICATION_REPOSITORY,
      inject: [ConfigService, PostgresNotificationRepository],
      useFactory: (config: ConfigService, postgres: PostgresNotificationRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryNotificationRepository(),
    },
    PostgresNotificationRepository,
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
