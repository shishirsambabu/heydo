'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  approve,
  clearSession,
  getOfficerName,
  getToken,
  getVerificationReadiness,
  listPending,
  PendingVerification,
  reject,
  VerificationReadiness,
} from '../../lib/api';

export default function VerificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [readiness, setReadiness] = useState<VerificationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingItems, readinessStatus] = await Promise.all([
        listPending(),
        getVerificationReadiness(),
      ]);
      setItems(pendingItems);
      setReadiness(readinessStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [load, router]);

  async function onApprove(id: string) {
    setActingId(id);
    try {
      await approve(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActingId(null);
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt('Reason for rejection?');
    if (!reason) return;
    setActingId(id);
    try {
      await reject(id, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActingId(null);
    }
  }

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="container">
      <div className="row">
        <div>
          <h1 className="page-title">VKYC Verification Queue</h1>
          <p className="page-sub">
            Signed in as {getOfficerName()} · review live VKYC results and approve or reject.
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-outline" href="/safety">
            Safety ops
          </Link>
          <Link className="btn btn-outline" href="/marketplace">
            Marketplace safety
          </Link>
          <button className="btn btn-outline" onClick={() => void load()}>
            Refresh
          </button>
          <button className="btn btn-outline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {readiness && <ReadinessPanel readiness={readiness} />}

      {error && <div className="error">{error}</div>}
      {!loading && items.length === 0 && (
        <div className="card empty">🎉 Queue is clear — no verifications awaiting review.</div>
      )}

      {items.map((v) => (
        <div className="card" key={v.id}>
          <div className="row">
            <div>
              <div className="label">Verification</div>
              <div className="display" style={{ fontSize: 16 }}>
                {v.id}
              </div>
              <div className="muted">
                worker {v.userId} · vendor {v.vendor} ·{' '}
                {v.vendorResultAt ? new Date(v.vendorResultAt).toLocaleString() : '—'}
              </div>
              <div className="signals">
                <span className="signal">
                  Liveness{' '}
                  <span className={`pill ${v.livenessPassed ? 'ok' : 'bad'}`}>
                    {v.livenessPassed ? 'passed' : 'failed'}
                  </span>
                </span>
                <span className="signal">
                  Aadhaar match{' '}
                  <span className={`pill ${v.aadhaarMatch ? 'ok' : 'bad'}`}>
                    {v.aadhaarMatch ? 'yes' : 'no'}
                  </span>
                </span>
                <span className="signal">
                  Face match <b>{v.faceMatchScore != null ? Math.round(v.faceMatchScore * 100) : '—'}%</b>
                </span>
              </div>
              <div className="muted">
                🔒 Aadhaar number &amp; video stay in the PII vault — not shown here.
              </div>
            </div>
            <div className="actions">
              <button
                className="btn btn-primary"
                disabled={actingId === v.id}
                onClick={() => void onApprove(v.id)}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                disabled={actingId === v.id}
                onClick={() => void onReject(v.id)}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadinessPanel({ readiness }: { readiness: VerificationReadiness }) {
  const checks: Array<[string, boolean]> = [
    ['Didit provider', readiness.checks.diditProviderEnabled],
    ['API key', readiness.checks.diditApiKeyConfigured],
    ['Worker workflow', readiness.checks.workerWorkflowConfigured],
    ['Giver workflow', readiness.checks.giverWorkflowConfigured],
    ['Webhook secret', readiness.checks.webhookSecretConfigured],
    ['Postgres persistence', readiness.checks.postgresPersistenceEnabled],
    ['Database URL', readiness.checks.databaseUrlConfigured],
  ];

  return (
    <section className="readiness-panel" aria-labelledby="readiness-title">
      <div className="row align-start">
        <div>
          <div className="label">Live VKYC readiness</div>
          <h2 id="readiness-title">Didit integration gate</h2>
          <p className="muted">
            Provider {readiness.provider} - persistence {readiness.persistence} - webhook {readiness.webhookDestinationPath}
          </p>
        </div>
        <span className={`pill ${readiness.readyForLiveDidit ? 'ok' : 'warn'}`}>
          {readiness.readyForLiveDidit ? 'configured' : 'needs setup'}
        </span>
      </div>

      <div className="readiness-grid">
        {checks.map(([label, ok]) => (
          <div className="readiness-check" key={label}>
            <span className={`pill ${ok ? 'ok' : 'bad'}`}>{ok ? 'ok' : 'missing'}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="readiness-next">
        <div className="label">Manual checks still required</div>
        <ul>
          {readiness.nextManualChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
