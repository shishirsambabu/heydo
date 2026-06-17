import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { VerificationError, VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

class StartDto {
  @IsOptional() @IsString() locale?: string;
}
class ResultDto {
  @IsString() sessionId!: string;
}

/**
 * Worker-facing VKYC endpoints. The worker grants consent, starts the live
 * session, and the vendor result is ingested (POST /result here simulates the
 * vendor webhook in dev; production validates a signed vendor callback).
 */
@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  /** DPDP consent for VKYC — required before starting. */
  @Post('consent')
  consent(@CurrentUser() p: AuthPrincipal) {
    return this.verification.recordConsent(p.sub, 'vkyc');
  }

  /** Start a live VKYC session; returns the vendor launch token for the app. */
  @Post('start')
  start(@CurrentUser() p: AuthPrincipal, @Body() dto: StartDto) {
    return this.verification.start(p.sub, dto.locale ?? 'ml');
  }

  /** DEV/webhook: ingest the vendor's VKYC result for a session. */
  @Post('result')
  async result(@Body() dto: ResultDto) {
    try {
      return await this.verification.handleVendorResult(dto.sessionId);
    } catch (error) {
      if (error instanceof VerificationError && error.code === 'result_not_final') {
        throw new ConflictException({
          code: error.code,
          message: 'VKYC result is not final yet',
        });
      }
      throw error;
    }
  }

  /** The worker's current verification status + apply eligibility. */
  @Get('status')
  status(@CurrentUser() p: AuthPrincipal) {
    return this.verification.statusFor(p.sub);
  }
}
