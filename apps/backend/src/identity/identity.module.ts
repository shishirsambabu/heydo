import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SecurityModule } from '../auth/security.module';
import {
  GiverProfileRepository,
  UserRepository,
  WorkerProfileRepository,
} from './identity.repository';
import { DatabaseModule } from '../common/database/database.module';
import {
  PostgresGiverProfileRepository,
  PostgresUserRepository,
  PostgresWorkerProfileRepository,
} from './postgres-identity.repository';

/**
 * Identity module — users, worker/giver profiles, role selection.
 * Exports the repositories so other modules can use them:
 *  - UserRepository (auth)
 *  - WorkerProfileRepository (verification, as the WorkerVerificationSink)
 */
@Module({
  imports: [SecurityModule, DatabaseModule],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    {
      provide: UserRepository,
      inject: [ConfigService, PostgresUserRepository],
      useFactory: (config: ConfigService, postgres: PostgresUserRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres' ? postgres : new UserRepository(),
    },
    {
      provide: WorkerProfileRepository,
      inject: [ConfigService, PostgresWorkerProfileRepository],
      useFactory: (config: ConfigService, postgres: PostgresWorkerProfileRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new WorkerProfileRepository(),
    },
    {
      provide: GiverProfileRepository,
      inject: [ConfigService, PostgresGiverProfileRepository],
      useFactory: (config: ConfigService, postgres: PostgresGiverProfileRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new GiverProfileRepository(),
    },
    PostgresUserRepository,
    PostgresWorkerProfileRepository,
    PostgresGiverProfileRepository,
  ],
  exports: [
    IdentityService,
    UserRepository,
    WorkerProfileRepository,
    GiverProfileRepository,
  ],
})
export class IdentityModule {}
