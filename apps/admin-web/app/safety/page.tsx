'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AdminSessionListItem,
  AuditHealth,
  clearSession,
  completeDevStepUp,
  getAuditHealth,
  getOfficerName,
  getToken,
  listAdminSessions,
  requireAdminStepUp,
  restoreAuditHealth,
  revokeAdminSession,
} from '../../lib/api';

export default function SafetyOpsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminSessionListItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [auditHealth, setAuditHealth] = useState<AuditHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [officerName, setOfficerName] = useState('officer');

  const riskyCount = useMemo(
    () => (summary.step_up_required ?? 0) + (summary.revoked ?? 0) + (summary.expired ?? 0),
    [summary],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionData, health] = await Promise.all([
        listAdminSessions(100),
        getAuditHealth(),
      ]);
      setSessions(sessionData.sessions);
      setSummary(sessionData.summary);
      setAuditHealth(health);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load safety operations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setOfficerName(getOfficerName());
    void load();
  }, [load, router]);

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  async function act(sessionId: string, action: 'step-up' | 'revoke') {
    const reason = window.prompt(action === 'step-up' ? 'Step-up reason?' : 'Revocation reason?');
    if (!reason) return;
    setActingId(sessionId);
    setNotice(null);
    setError(null);
    try {
      if (action === 'step-up') {
        await requireAdminStepUp(sessionId, reason);
        setNotice('Step-up required for selected session.');
      } else {
        await revokeAdminSession(sessionId, reason);
        setNotice('Session revoked.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Session action failed');
    } finally {
      setActingId(null);
    }
  }

  async function completeStepUp() {
    const secret = window.prompt('Admin dev secret?');
    if (!secret) return;
    setNotice(null);
    setError(null);
    try {
      await completeDevStepUp(secret);
      setNotice('Current session step-up completed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Step-up failed');
    }
  }

  async function restoreAudit() {
    const reason = window.prompt('Recovery reason?');
    if (!reason) return;
    const remediationRef = window.prompt('Incident/remediation reference?');
    if (!remediationRef) return;
    const investigatedByAdminId = window.prompt('Investigated by admin id?');
    if (!investigatedByAdminId) return;
    setNotice(null);
    setError(null);
    try {
      const health = await restoreAuditHealth(reason, remediationRef, investigatedByAdminId);
      setAuditHealth(health);
      setNotice('Audit health restored after recovery record was written.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit recovery failed');
    }
  }

  return (
    <div className="container wide">
      <div className="row">
        <div>
          <h1 className="page-title">Admin Safety Ops</h1>
          <p className="page-sub">
            Signed in as {officerName} - monitor sessions, step-up, revocation, and audit health.
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-outline" href="/marketplace">
            Marketplace
          </Link>
          <Link className="btn btn-outline" href="/verifications">
            VKYC queue
          </Link>
          <button className="btn btn-outline" onClick={() => void load()}>
            Refresh
          </button>
          <button className="btn btn-outline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Audit health" value={auditHealth?.status ?? 'unknown'} tone={auditHealth?.status === 'ok' ? 'ok' : 'bad'} />
        <Stat label="Failed audit writes" value={String(auditHealth?.failedWriteCount ?? 0)} tone={auditHealth?.failedWriteCount ? 'bad' : 'ok'} />
        <Stat label="Active sessions" value={String(summary.active ?? 0)} tone="ok" />
        <Stat label="Needs attention" value={String(riskyCount)} tone={riskyCount ? 'warn' : 'ok'} />
      </div>

      {loading && <div className="empty">Loading...</div>}
      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      {!loading && auditHealth && (
        <div className="card">
          <div className="row align-start">
            <div>
              <div className="label">Audit health</div>
              <div className="display compact">{auditHealth.status}</div>
              <div className="muted">Failed writes: {auditHealth.failedWriteCount}</div>
              {auditHealth.recentFailures.length > 0 && (
                <div className="mini-table">
                  {auditHealth.recentFailures.map((failure) => (
                    <div className="mini-row" key={failure.recordId}>
                      <span>{failure.action}</span>
                      <span>{failure.targetType}:{failure.targetId}</span>
                      <span>{failure.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="actions">
              <button className="btn btn-outline" onClick={() => void completeStepUp()}>
                Complete step-up
              </button>
              <button className="btn btn-danger" onClick={() => void restoreAudit()}>
                Restore audit
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <div className="row align-start">
            <div>
              <div className="label">Admin sessions</div>
              <div className="display compact">Session registry</div>
            </div>
          </div>
          <div className="session-list">
            {sessions.length === 0 && <div className="empty">No admin sessions found.</div>}
            {sessions.map((session) => (
              <div className="session-row" key={session.id}>
                <div>
                  <div className="session-title">
                    {session.adminId}
                    <span className={`pill ${statusTone(session.status)}`}>{session.status}</span>
                  </div>
                  <div className="muted">
                    {session.id} - {session.deviceId}
                  </div>
                  <div className="muted">
                    MFA {formatDate(session.mfaVerifiedAt)} - expires {formatDate(session.expiresAt)}
                  </div>
                  {session.stepUpReason && <div className="muted">Step-up reason: {session.stepUpReason}</div>}
                </div>
                <div className="actions">
                  <button
                    className="btn btn-outline"
                    disabled={actingId === session.id || session.status === 'revoked'}
                    onClick={() => void act(session.id, 'step-up')}
                  >
                    Step-up
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={actingId === session.id || session.status === 'revoked'}
                    onClick={() => void act(session.id, 'revoke')}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
    </div>
  );
}

function statusTone(status: AdminSessionListItem['status']) {
  if (status === 'active') return 'ok';
  if (status === 'step_up_required') return 'warn';
  return 'bad';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}
