import { createHmac } from 'crypto';
import { verifyDiditSignature } from './didit-webhook-signature';

describe('verifyDiditSignature', () => {
  const secret = 'didit_webhook_secret';
  const now = 1774970000;
  const body = {
    webhook_type: 'status.updated',
    timestamp: now,
    session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    status: 'Approved',
    metadata: { name: 'José', nested: { b: 2, a: 1 } },
  };

  it('verifies X-Signature-V2 using sorted compact JSON', () => {
    const canonical =
      '{"metadata":{"name":"José","nested":{"a":1,"b":2}},"session_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","status":"Approved","timestamp":1774970000,"webhook_type":"status.updated"}';
    const signatureV2 = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

    expect(
      verifyDiditSignature({
        body,
        secret,
        timestampHeader: String(now),
        signatureV2,
        nowSeconds: now,
      }),
    ).toBe(true);
  });

  it('falls back to X-Signature-Simple for envelope authentication', () => {
    const signatureSimple = createHmac('sha256', secret)
      .update(`${now}:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:Approved:status.updated`)
      .digest('hex');

    expect(
      verifyDiditSignature({
        body,
        secret,
        timestampHeader: String(now),
        signatureSimple,
        nowSeconds: now,
      }),
    ).toBe(true);
  });

  it('rejects stale webhooks', () => {
    const signatureSimple = createHmac('sha256', secret)
      .update(`${now}:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:Approved:status.updated`)
      .digest('hex');

    expect(
      verifyDiditSignature({
        body,
        secret,
        timestampHeader: String(now),
        signatureSimple,
        nowSeconds: now + 301,
      }),
    ).toBe(false);
  });
});
