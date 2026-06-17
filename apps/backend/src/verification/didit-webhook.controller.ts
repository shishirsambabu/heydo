import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiditWebhookEnvelope,
  verifyDiditSignature,
} from './didit-webhook-signature';
import { VerificationError, VerificationService } from './verification.service';

@Controller('webhooks/didit')
export class DiditWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly verification: VerificationService,
  ) {}

  @Post()
  async receive(
    @Body() body: DiditWebhookEnvelope,
    @Headers('x-timestamp') timestamp?: string,
    @Headers('x-signature-v2') signatureV2?: string,
    @Headers('x-signature-simple') signatureSimple?: string,
  ) {
    const secret = this.config.get<string>('DIDIT_WEBHOOK_SECRET');
    if (!secret) throw new UnauthorizedException('Didit webhook secret not configured');
    const ok = verifyDiditSignature({
      body,
      secret,
      timestampHeader: timestamp,
      signatureV2,
      signatureSimple,
    });
    if (!ok) throw new UnauthorizedException('Invalid Didit webhook signature');

    if (!isSessionEvent(body.webhook_type) || !body.session_id || !isFinalStatus(body.status)) {
      return { ok: true, ignored: true };
    }

    try {
      await this.verification.handleVendorResult(body.session_id);
      return { ok: true };
    } catch (error) {
      if (error instanceof VerificationError) {
        if (error.code === 'already_processed') {
          return { ok: true, duplicate: true };
        }
        if (error.code === 'unknown_session') {
          return { ok: true, unknownSession: true };
        }
      }
      throw error;
    }
  }
}

function isSessionEvent(type: unknown): boolean {
  return type === 'status.updated' || type === 'data.updated';
}

function isFinalStatus(status: unknown): boolean {
  return status === 'Approved' || status === 'Declined';
}
