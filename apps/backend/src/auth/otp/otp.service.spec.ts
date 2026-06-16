import { MockOtpSender } from './otp-sender';
import { OtpService, OtpConfig } from './otp.service';

const cfg: OtpConfig = {
  ttlSeconds: 300,
  maxAttempts: 3,
  resendCooldownSeconds: 30,
  codeLength: 6,
};

describe('OtpService', () => {
  it('sends a 6-digit code that verifies successfully', async () => {
    const sender = new MockOtpSender();
    const svc = new OtpService(sender, cfg);
    await svc.request('+919000000001');
    const code = sender.peek('+919000000001')!;
    expect(code).toMatch(/^\d{6}$/);
    expect(svc.verify('+919000000001', code)).toEqual({ ok: true });
  });

  it('rejects a wrong code and counts attempts up to the limit', async () => {
    const sender = new MockOtpSender();
    const svc = new OtpService(sender, cfg);
    await svc.request('+919000000002');
    expect(svc.verify('+919000000002', '000000')).toEqual({ ok: false, reason: 'mismatch' });
    expect(svc.verify('+919000000002', '000000')).toEqual({ ok: false, reason: 'mismatch' });
    expect(svc.verify('+919000000002', '000000')).toEqual({ ok: false, reason: 'mismatch' });
    // 4th attempt is locked out
    expect(svc.verify('+919000000002', '000000')).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('is single-use: a verified code cannot be reused', async () => {
    const sender = new MockOtpSender();
    const svc = new OtpService(sender, cfg);
    await svc.request('+919000000003');
    const code = sender.peek('+919000000003')!;
    expect(svc.verify('+919000000003', code).ok).toBe(true);
    expect(svc.verify('+919000000003', code)).toEqual({ ok: false, reason: 'no_challenge' });
  });

  it('expires codes after the TTL', async () => {
    const sender = new MockOtpSender();
    let t = 1_000_000;
    const svc = new OtpService(sender, cfg, () => t);
    await svc.request('+919000000004');
    const code = sender.peek('+919000000004')!;
    t += cfg.ttlSeconds * 1000 + 1; // advance past expiry
    expect(svc.verify('+919000000004', code)).toEqual({ ok: false, reason: 'expired' });
  });

  it('throttles resends within the cooldown window', async () => {
    const sender = new MockOtpSender();
    let t = 5_000_000;
    const svc = new OtpService(sender, cfg, () => t);
    await svc.request('+919000000005');
    const second = await svc.request('+919000000005');
    expect(second.sent).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(0);
    t += cfg.resendCooldownSeconds * 1000;
    const third = await svc.request('+919000000005');
    expect(third.sent).toBe(true);
  });
});
