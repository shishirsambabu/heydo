import { createHmac, timingSafeEqual } from 'crypto';

const MAX_SKEW_SECONDS = 300;

export interface DiditWebhookEnvelope {
  timestamp?: number;
  session_id?: string;
  status?: string;
  webhook_type?: string;
  [key: string]: unknown;
}

export function verifyDiditSignature(params: {
  body: DiditWebhookEnvelope;
  secret: string;
  timestampHeader?: string;
  signatureV2?: string;
  signatureSimple?: string;
  nowSeconds?: number;
}): boolean {
  const timestamp = Number(params.timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_SKEW_SECONDS) return false;

  if (
    params.signatureV2 &&
    hmacEqual(params.signatureV2, canonicalJson(params.body), params.secret)
  ) {
    return true;
  }
  if (
    params.signatureSimple &&
    hmacEqual(params.signatureSimple, simpleCanonical(params.body), params.secret)
  ) {
    return true;
  }
  return false;
}

function hmacEqual(signature: string, payload: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(shortenWholeFloats(value)));
}

function simpleCanonical(body: DiditWebhookEnvelope): string {
  return [
    body.timestamp ?? '',
    body.session_id ?? '',
    body.status ?? '',
    body.webhook_type ?? '',
  ].join(':');
}

function shortenWholeFloats(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shortenWholeFloats);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        shortenWholeFloats(nested),
      ]),
    );
  }
  if (typeof value === 'number' && !Number.isInteger(value) && value % 1 === 0) {
    return Math.trunc(value);
  }
  return value;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
