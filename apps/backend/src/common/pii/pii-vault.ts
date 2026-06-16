import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * PII Vault — the isolated, encrypted store for radioactive data
 * (Aadhaar tokens, VKYC media references, etc.).
 *
 * Services NEVER hold raw PII; they store it here and keep only an opaque
 * vault reference. Only authorized flows resolve a reference back to plaintext,
 * and every access is auditable.
 *
 * Production: backed by an isolated datastore + AWS KMS envelope encryption.
 * Dev/Phase 1: AES-256-GCM in-memory implementation below.
 *
 * See .claude/rules/pii_and_privacy.md and docs/phase-0/02-data-model.md (PII classes).
 */
export interface PiiVault {
  /** Encrypt + store a secret, return an opaque reference token. */
  store(value: string): Promise<string>;
  /** Resolve a reference back to plaintext (authorized callers only). */
  resolve(ref: string): Promise<string | null>;
  /** Permanently delete (DPDP erasure / retention expiry). */
  erase(ref: string): Promise<void>;
}

export const PII_VAULT = Symbol('PII_VAULT');

interface VaultRecord {
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * In-memory AES-256-GCM vault for development and tests.
 * Real plaintext is never kept; only encrypted records, keyed by a random ref.
 */
export class InMemoryPiiVault implements PiiVault {
  private readonly store_ = new Map<string, VaultRecord>();
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    // Derive a stable 32-byte key from the configured secret.
    this.key = createHash('sha256').update(encryptionKey).digest();
  }

  async store(value: string): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ref = `vault_${randomBytes(16).toString('hex')}`;
    this.store_.set(ref, {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });
    return ref;
  }

  async resolve(ref: string): Promise<string | null> {
    const rec = this.store_.get(ref);
    if (!rec) return null;
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(rec.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(rec.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(rec.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  async erase(ref: string): Promise<void> {
    this.store_.delete(ref);
  }
}
