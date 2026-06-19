import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../common/database/database.module';
import { AuditService } from '../common/audit/audit.service';
import { IdentityModule } from '../identity/identity.module';
import { GiverProfileRepository } from '../identity/identity.repository';
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
  EscalationPackageRepository,
  GigRepository,
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  CATEGORY_REPOSITORY,
  ESCALATION_PACKAGE_REPOSITORY,
  GIG_REPOSITORY,
  InMemoryApplicationRepository,
  InMemoryAssignmentRepository,
  InMemoryCategoryRepository,
  InMemoryEscalationPackageRepository,
  InMemoryGigRepository,
  InMemorySafetyReportRepository,
  SAFETY_REPORT_REPOSITORY,
} from './marketplace.repository';
import {
  PostgresApplicationRepository,
  PostgresAssignmentRepository,
  PostgresCategoryRepository,
  PostgresEscalationPackageRepository,
  PostgresGigRepository,
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
    PostgresSafetyReportRepository,
    PostgresEscalationPackageRepository,
    {
      provide: MarketplaceService,
      inject: [
        CATEGORY_REPOSITORY,
        GIG_REPOSITORY,
        APPLICATION_REPOSITORY,
        ASSIGNMENT_REPOSITORY,
        SAFETY_REPORT_REPOSITORY,
        ESCALATION_PACKAGE_REPOSITORY,
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
        safetyReports,
        escalationPackages: EscalationPackageRepository,
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
          safetyReports,
          escalationPackages,
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
