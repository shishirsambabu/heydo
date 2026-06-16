/**
 * OtpSender — swappable abstraction over the SMS/OTP delivery vendor.
 * Phase 1 uses MockOtpSender (logs a masked record, never the live OTP to users).
 * Real impls (MSG91 / AWS SNS) plug in behind this interface.
 * See .claude/geniuses/platform/integration_genius.md
 */
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');

/**
 * Dev sender. Captures the last code per phone so tests/dev can retrieve it
 * WITHOUT printing OTPs to logs. Never use in production.
 */
export class MockOtpSender implements OtpSender {
  private readonly lastByPhone = new Map<string, string>();

  async send(phone: string, code: string): Promise<void> {
    this.lastByPhone.set(phone, code);
  }

  /** Dev/test only: retrieve the code that would have been SMS'd. */
  peek(phone: string): string | undefined {
    return this.lastByPhone.get(phone);
  }
}
