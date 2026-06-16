import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SecurityModule } from '../auth/security.module';
import {
  GiverProfileRepository,
  UserRepository,
  WorkerProfileRepository,
} from './identity.repository';

/**
 * Identity module — users, worker/giver profiles, role selection.
 * Exports the repositories so other modules can use them:
 *  - UserRepository (auth)
 *  - WorkerProfileRepository (verification, as the WorkerVerificationSink)
 */
@Module({
  imports: [SecurityModule],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    UserRepository,
    WorkerProfileRepository,
    GiverProfileRepository,
  ],
  exports: [
    IdentityService,
    UserRepository,
    WorkerProfileRepository,
    GiverProfileRepository,
  ],
})
export class IdentityModule {}
