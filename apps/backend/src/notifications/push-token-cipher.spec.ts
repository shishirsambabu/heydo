import { PushTokenCipher } from './push-token-cipher';

describe('PushTokenCipher', () => {
  it('encrypts registration tokens with authenticated encryption', () => {
    const cipher = new PushTokenCipher('test-secret');
    const token = 'fcm-registration-token-value';
    const encrypted = cipher.encrypt(token);

    expect(encrypted).not.toContain(token);
    expect(cipher.decrypt(encrypted)).toBe(token);
    expect(cipher.fingerprint(token)).toHaveLength(64);
  });

  it('rejects tampered ciphertext', () => {
    const cipher = new PushTokenCipher('test-secret');
    const encrypted = cipher.encrypt('fcm-registration-token-value');
    expect(() => cipher.decrypt(`${encrypted}x`)).toThrow();
  });
});
