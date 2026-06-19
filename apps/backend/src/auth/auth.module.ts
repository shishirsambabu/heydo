import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { OtpService, OtpConfig } from './otp/otp.service';
import { MockOtpSender, OTP_SENDER, OtpSender } from './otp/otp-sender';
import { SecurityModule } from './security.module';
import { CommonModule } from '../common/common.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [SecurityModule, CommonModule, IdentityModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    // Phase 1 uses the mock SMS sender (selectable later via OTP_SENDER config).
    { provide: OTP_SENDER, useClass: MockOtpSender },
    {
      provide: OtpService,
      inject: [OTP_SENDER, ConfigService],
      useFactory: (sender: OtpSender, config: ConfigService) => {
        const cfg: OtpConfig = {
          ttlSeconds: Number(config.get('OTP_TTL_SECONDS') ?? 300),
          maxAttempts: Number(config.get('OTP_MAX_ATTEMPTS') ?? 5),
          resendCooldownSeconds: 30,
          codeLength: 6,
        };
        return new OtpService(sender, cfg);
      },
    },
  ],
})
export class AuthModule {}
