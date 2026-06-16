import { maskPhone, maskName, redactForLog } from './redaction';

describe('PII redaction', () => {
  it('masks all but the last 2 digits of a phone', () => {
    expect(maskPhone('+919812345678')).toBe('**********78');
    expect(maskPhone('98765')).toBe('***65');
  });

  it('masks names to first letter + dots', () => {
    expect(maskName('Ravi Kumar')).toBe('R*** K****');
  });

  it('removes forbidden keys (aadhaar, otp, token) from log objects', () => {
    const safe = redactForLog({
      userId: 'u1',
      aadhaar_token: 'XXXX-secret',
      otp: '123456',
      token: 'jwt.abc.def',
      nested: { faceData: 'binary', ok: true },
    }) as Record<string, any>;

    expect(safe.aadhaar_token).toBe('[REDACTED]');
    expect(safe.otp).toBe('[REDACTED]');
    expect(safe.token).toBe('[REDACTED]');
    expect(safe.nested.faceData).toBe('[REDACTED]');
    expect(safe.nested.ok).toBe(true);
    expect(safe.userId).toBe('u1');
  });

  it('masks phone and name fields in log objects', () => {
    const safe = redactForLog({ phone: '+919812345678', displayName: 'Ravi Kumar' }) as Record<
      string,
      any
    >;
    expect(safe.phone).toBe('**********78');
    expect(safe.displayName).toBe('R*** K****');
  });

  it('never leaks a raw Aadhaar-like string anywhere in serialized output', () => {
    const aadhaar = '2345-6789-0123';
    const serialized = JSON.stringify(
      redactForLog({ verification: { aadhaar_token: aadhaar, status: 'approved' } }),
    );
    expect(serialized).not.toContain(aadhaar);
    expect(serialized).toContain('approved');
  });
});
