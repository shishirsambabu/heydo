import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../common/database/database.module';
import { AuditService } from '../common/audit/audit.service';
import { IdentityModule } from '../identity/identity.module';
import { GiverProfileRepository } from '../identity/identity.repository';
import { VerificationModule } from '../verification/verification.module';
import { VerificationService } from '../verification/verification.service';
import { MarketplaceController } from './marketplace.controller';
import {
  ApplicationRepository,
  AssignmentRepository,
  CategoryRepository,
  GigRepository,
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  CATEGORY_REPOSITORY,
  GIG_REPOSITORY,
  InMemoryApplicationRepository,
  InMemoryAssignmentRepository,
  InMemoryCategoryRepository,
  InMemoryGigRepository,
} from './marketplace.repository';
import {
  PostgresApplicationRepository,
  PostgresAssignmentRepository,
  PostgresCategoryRepository,
  PostgresGigRepository,
} from './postgres-marketplace.repository';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [SecurityModule, CommonModule, DatabaseModule, IdentityModule, VerificationModule],
  controllers: [MarketplaceController],
  providers: [
    {
      provide: CATEGORY_REPOSITORY,
      inject: [ConfigService, PostgresCategoryRepository],
      useFactory: (config: ConfigService, postgres: PostgresCategoryRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryCategoryRepository(),
    },
    {
      provide: GIG_REPOSITORY,
      inject: [ConfigService, PostgresGigRepository],
      useFactory: (config: ConfigService, postgres: PostgresGigRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres' ? postgres : new InMemoryGigRepository(),
    },
    {
      provide: APPLICATION_REPOSITORY,
      inject: [ConfigService, PostgresApplicationRepository],
      useFactory: (config: ConfigService, postgres: PostgresApplicationRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryApplicationRepository(),
    },
    {
      provide: ASSIGNMENT_REPOSITORY,
      inject: [ConfigService, PostgresAssignmentRepository],
      useFactory: (config: ConfigService, postgres: PostgresAssignmentRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryAssignmentRepository(),
    },
    PostgresCategoryRepository,
    PostgresGigRepository,
    PostgresApplicationRepository,
    PostgresAssignmentRepository,
    {
      provide: MarketplaceService,
      inject: [
        CATEGORY_REPOSITORY,
        GIG_REPOSITORY,
        APPLICATION_REPOSITORY,
        ASSIGNMENT_REPOSITORY,
        GiverProfileRepository,
        VerificationService,
        AuditService,
      ],
      useFactory: (
        categories: CategoryRepository,
        gigs: GigRepository,
        applications: ApplicationRepository,
        assignments: AssignmentRepository,
        givers: GiverProfileRepository,
        verification: VerificationService,
        audit: AuditService,
      ) =>
        new MarketplaceService(
          categories,
          gigs,
          applications,
          assignments,
          givers,
          verification,
          audit,
        ),
    },
  ],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
