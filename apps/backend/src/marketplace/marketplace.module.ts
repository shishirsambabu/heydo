import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../common/database/database.module';
import { AuditService } from '../common/audit/audit.service';
import { IdentityModule } from '../identity/identity.module';
import { GiverProfileRepository, UserRepository } from '../identity/identity.repository';
import { MoneyModule } from '../money/money.module';
import { MoneyService } from '../money/money.service';
import { VerificationModule } from '../verification/verification.module';
import { VerificationService } from '../verification/verification.service';
import { MarketplaceController } from './marketplace.controller';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import {
  ApplicationRepository,
  AssignmentRepository,
  CategoryRepository,
  EvidenceVaultRefRepository,
  EscalationPackageRepository,
  GigRepository,
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  CATEGORY_REPOSITORY,
  EVIDENCE_VAULT_REF_REPOSITORY,
  ESCALATION_PACKAGE_REPOSITORY,
  GIG_REPOSITORY,
  InMemoryApplicationRepository,
  InMemoryAssignmentRepository,
  InMemoryCategoryRepository,
  InMemoryEvidenceVaultRefRepository,
  InMemoryEscalationPackageRepository,
  InMemoryGigRepository,
  InMemoryRatingRepository,
  InMemorySafetyReportRepository,
  RATING_REPOSITORY,
  RatingRepository,
  SAFETY_REPORT_REPOSITORY,
} from './marketplace.repository';
import {
  PostgresApplicationRepository,
  PostgresAssignmentRepository,
  PostgresCategoryRepository,
  PostgresEvidenceVaultRefRepository,
  PostgresEscalationPackageRepository,
  PostgresGigRepository,
  PostgresRatingRepository,
  PostgresSafetyReportRepository,
} from './postgres-marketplace.repository';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [SecurityModule, CommonModule, DatabaseModule, IdentityModule, VerificationModule, MoneyModule],
  controllers: [MarketplaceController, AdminMarketplaceController],
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
    {
      provide: SAFETY_REPORT_REPOSITORY,
      inject: [ConfigService, PostgresSafetyReportRepository],
      useFactory: (config: ConfigService, postgres: PostgresSafetyReportRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemorySafetyReportRepository(),
    },
    {
      provide: RATING_REPOSITORY,
      inject: [ConfigService, PostgresRatingRepository],
      useFactory: (config: ConfigService, postgres: PostgresRatingRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryRatingRepository(),
    },
    {
      provide: EVIDENCE_VAULT_REF_REPOSITORY,
      inject: [ConfigService, PostgresEvidenceVaultRefRepository],
      useFactory: (config: ConfigService, postgres: PostgresEvidenceVaultRefRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryEvidenceVaultRefRepository(),
    },
    {
      provide: ESCALATION_PACKAGE_REPOSITORY,
      inject: [ConfigService, PostgresEscalationPackageRepository],
      useFactory: (config: ConfigService, postgres: PostgresEscalationPackageRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryEscalationPackageRepository(),
    },
    PostgresCategoryRepository,
    PostgresGigRepository,
    PostgresApplicationRepository,
    PostgresAssignmentRepository,
    PostgresRatingRepository,
    PostgresSafetyReportRepository,
    PostgresEvidenceVaultRefRepository,
    PostgresEscalationPackageRepository,
    {
      provide: MarketplaceService,
      inject: [
        CATEGORY_REPOSITORY,
        GIG_REPOSITORY,
        APPLICATION_REPOSITORY,
        ASSIGNMENT_REPOSITORY,
        RATING_REPOSITORY,
        SAFETY_REPORT_REPOSITORY,
        EVIDENCE_VAULT_REF_REPOSITORY,
        ESCALATION_PACKAGE_REPOSITORY,
        UserRepository,
        GiverProfileRepository,
        VerificationService,
        AuditService,
        MoneyService,
      ],
      useFactory: (
        categories: CategoryRepository,
        gigs: GigRepository,
        applications: ApplicationRepository,
        assignments: AssignmentRepository,
        ratings: RatingRepository,
        safetyReports,
        evidenceVaultRefs: EvidenceVaultRefRepository,
        escalationPackages: EscalationPackageRepository,
        users: UserRepository,
        givers: GiverProfileRepository,
        verification: VerificationService,
        audit: AuditService,
        money: MoneyService,
      ) =>
        new MarketplaceService(
          categories,
          gigs,
          applications,
          assignments,
          ratings,
          safetyReports,
          evidenceVaultRefs,
          escalationPackages,
          users,
          givers,
          verification,
          audit,
          undefined,
          undefined,
          money,
        ),
    },
  ],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
