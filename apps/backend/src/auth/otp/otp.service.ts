import { randomInt } from 'crypto';
import { OtpSender } from './otp-sender';

/**
 * OTP challenge logic — request + verify, with expiry, attempt limits, and
 * resend throttling. Hardened against brute force (Security Sentinel /
 * authentication_genius). Pure and unit-tested; storage is in-memory for Phase 1.
 */
export interface OtpConfig {
  ttlSeconds: number; // code validity window
  maxAttempts: number; // wrong tries before lockout
  resendCooldownSeconds: number; // min gap between sends
  codeLength: number;
}

export const DEFAULT_OTP_CONFIG: OtpConfig = {
  ttlSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 30,
  codeLength: 6,
};

interface Challenge {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no_challenge' | 'expired' | 'too_many_attempts' | 'mismatch' };

export class OtpService {
  private readonly challenges = new Map<string, Challenge>();

  constructor(
    private readonly sender: OtpSender,
    private readonly config: OtpConfig = DEFAULT_OTP_CONFIG,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Generate + send a code. Throttles resends. Returns when allowed. */
  async request(phone: string): Promise<{ sent: boolean; retryAfterMs?: number }> {
    const t = this.now();
    const existing = this.challenges.get(phone);
    if (existing) {
      const since = t - existing.lastSentAt;
      const cooldown = this.config.resendCooldownSeconds * 1000;
      if (since < cooldown) {
        return { sent: false, retryAfterMs: cooldown - since };
      }
    }
    const code = this.generateCode();
    this.challenges.set(phone, {
      code,
      expiresAt: t + this.config.ttlSeconds * 1000,
      attempts: 0,
      lastSentAt: t,
    });
    await this.sender.send(phone, code);
    return { sent: true };
  }

  /** Verify a submitted code. Consumes the challenge on success. */
  verify(phone: string, code: string): VerifyResult {
    const challenge = this.challenges.get(phone);
    if (!challenge) return { ok: false, reason: 'no_challenge' };
    if (this.now() > challenge.expiresAt) {
      this.challenges.delete(phone);
      return { ok: false, reason: 'expired' };
    }
    if (challenge.attempts >= this.config.maxAttempts) {
      this.challenges.delete(phone);
      return { ok: false, reason: 'too_many_attempts' };
    }
    if (challenge.code !== code) {
      challenge.attempts += 1;
      return { ok: false, reason: 'mismatch' };
    }
    this.challenges.delete(phone); // single-use
    return { ok: true };
  }

  private generateCode(): string {
    const max = 10 ** this.config.codeLength;
    return randomInt(0, max).toString().padStart(this.config.codeLength, '0');
  }
}
