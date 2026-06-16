import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { AdminVerificationController } from './admin-verification.controller';
import {
  CONSENT_REPOSITORY,
  ConsentRepository,
  InMemoryConsentRepository,
  InMemoryVerificationRepository,
  VERIFICATION_REPOSITORY,
  VerificationRepository,
} from './verification.repository';
import { MockVkycProvider } from './vkyc/mock-vkyc-provider';
import { VKYC_PROVIDER, VkycProvider } from './vkyc/vkyc-provider';
import { PII_VAULT, PiiVault } from '../common/pii/pii-vault';
import { AuditService } from '../common/audit/audit.service';
import { SecurityModule } from '../auth/security.module';
import { IdentityModule } from '../identity/identity.module';
import { WorkerProfileRepository } from '../identity/identity.repository';

/**
 * Verification (VKYC) module. Phase 1 binds in-memory repositories and the mock
 * VKYC provider; production swaps the persistence + the licensed vendor behind
 * the same tokens. The WorkerProfileRepository is injected as the
 * WorkerVerificationSink so a worker's status stays in sync.
 */
@Module({
  imports: [SecurityModule, IdentityModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [
    { provide: VERIFICATION_REPOSITORY, useClass: InMemoryVerificationRepository },
    { provide: CONSENT_REPOSITORY, useClass: InMemoryConsentRepository },
    { provide: VKYC_PROVIDER, useClass: MockVkycProvider },
    {
      provide: VerificationService,
      inject: [
        VERIFICATION_REPOSITORY,
        CONSENT_REPOSITORY,
        VKYC_PROVIDER,
        PII_VAULT,
        AuditService,
        WorkerProfileRepository,
      ],
      useFactory: (
        verifications: VerificationRepository,
        consents: ConsentRepository,
        vkyc: VkycProvider,
        vault: PiiVault,
        audit: AuditService,
        sink: WorkerProfileRepository,
      ) => new VerificationService(verifications, consents, vkyc, vault, audit, sink),
    },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
