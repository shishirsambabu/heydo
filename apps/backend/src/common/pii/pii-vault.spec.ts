import { InMemoryPiiVault } from './pii-vault';

describe('InMemoryPiiVault (AES-256-GCM)', () => {
  it('stores a secret and resolves it back to the original plaintext', async () => {
    const vault = new InMemoryPiiVault('test-key');
    const ref = await vault.store('aadhaar-token-abc');
    expect(ref).toMatch(/^vault_/);
    expect(await vault.resolve(ref)).toBe('aadhaar-token-abc');
  });

  it('produces a distinct reference for each store and never exposes plaintext in the ref', async () => {
    const vault = new InMemoryPiiVault('test-key');
    const r1 = await vault.store('secret-1');
    const r2 = await vault.store('secret-1');
    expect(r1).not.toBe(r2); // unique refs
    expect(r1).not.toContain('secret-1'); // ref is opaque
  });

  it('returns null for an unknown reference', async () => {
    const vault = new InMemoryPiiVault('test-key');
    expect(await vault.resolve('vault_does_not_exist')).toBeNull();
  });

  it('erases a secret (DPDP erasure / retention expiry)', async () => {
    const vault = new InMemoryPiiVault('test-key');
    const ref = await vault.store('to-be-erased');
    await vault.erase(ref);
    expect(await vault.resolve(ref)).toBeNull();
  });
});
