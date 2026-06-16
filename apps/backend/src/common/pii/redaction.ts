/**
 * PII redaction utilities.
 *
 * Rule: PII is radioactive — never log Aadhaar, VKYC media, face data, or full
 * phone/address. These helpers produce safe-to-log representations.
 * See .claude/rules/pii_and_privacy.md
 */

/** Mask a phone number to the last 2 digits: +91XXXXXX89 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last2 = digits.slice(-2);
  return `${'*'.repeat(Math.max(0, digits.length - 2))}${last2}`;
}

/** Mask a name to first letter + dots: "Ravi Kumar" -> "R*** K****" */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] + '*'.repeat(Math.max(1, part.length - 1)))
    .join(' ');
}

/** Fields that must NEVER appear in logs/analytics in any form. */
const FORBIDDEN_KEYS = new Set([
  'aadhaar',
  'aadhaarnumber',
  'aadhaar_number',
  'aadhaartoken',
  'aadhaar_token',
  'facedata',
  'face_data',
  'vkycmedia',
  'vkyc_media',
  'mediaref',
  'media_ref',
  'otp',
  'password',
  'jwt',
  'token',
  'authorization',
]);

/** Keys that should be masked (kept partially) rather than removed. */
const MASK_KEYS: Record<string, (v: string) => string> = {
  phone: maskPhone,
  mobile: maskPhone,
  name: maskName,
  displayname: maskName,
  display_name: maskName,
};

/**
 * Deep-clone an object into a log-safe form: forbidden keys removed,
 * sensitive keys masked. Use this before logging ANY object that might
 * carry user data.
 */
export function redactForLog(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((v) => redactForLog(v, depth + 1));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const norm = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(norm)) {
        out[key] = '[REDACTED]';
      } else if (MASK_KEYS[norm] && typeof value === 'string') {
        out[key] = MASK_KEYS[norm](value);
      } else {
        out[key] = redactForLog(value, depth + 1);
      }
    }
    return out;
  }
  return '[unloggable]';
}
