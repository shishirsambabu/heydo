'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { devLogin, saveSession } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('Anita (Officer)');
  const [secret, setSecret] = useState('dev-admin-secret');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const token = await devLogin(name, secret);
      saveSession(token, name);
      router.push('/verifications');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="login-wrap card">
        <h1 className="page-title">Officer sign-in</h1>
        <p className="page-sub">Dev login. Real admin auth is SSO + MFA (Phase 7).</p>
        <label className="label">Your name</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Access secret</label>
        <input
          className="field"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in as Verification Officer'}
        </button>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
