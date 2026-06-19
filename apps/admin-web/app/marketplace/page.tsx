'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AdminDecisionPayload,
  AdminDecisionReasonAction,
  AdminDecisionReasonCatalog,
  AdminGig,
  clearSession,
  getDecisionReasons,
  getOfficerName,
  getToken,
  listOpenSafetyReports,
  listReviewGigs,
  moderateGig,
  reviewSafetyReport,
  SafetyReport,
} from '../../lib/api';

type QueueTab = 'gigs' | 'reports';

export default function MarketplaceSafetyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<QueueTab>('gigs');
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [reasons, setReasons] = useState<AdminDecisionReasonCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      gigs: gigs.length,
      reports: reports.length,
    }),
    [gigs.length, reports.length],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gigItems, reportItems, reasonCatalog] = await Promise.all([
        listReviewGigs(),
        listOpenSafetyReports(),
        getDecisionReasons(),
      ]);
      setGigs(gigItems);
      setReports(reportItems);
      setReasons(reasonCatalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace queues');
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

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  function chooseDecisionPayload(action: AdminDecisionReasonAction): AdminDecisionPayload | null {
    const choices = reasons?.[action] ?? [];
    if (!choices.length) {
      setError(`No decision reasons loaded for ${action}`);
      return null;
    }

    const reasonMenu = choices
      .map((reason, index) => `${index + 1}. ${reason.label} (${reason.code})`)
      .join('\n');
    const selected = window.prompt(`Choose reason for ${action}:\n${reasonMenu}`);
    if (!selected) return null;

    const trimmed = selected.trim();
    const reason = choices[Number(trimmed) - 1] ?? choices.find((item) => item.code === trimmed);
    if (!reason) {
      setError('Choose a valid reason number or reason code.');
      return null;
    }

    const note = window.prompt('Decision note? Minimum 10 characters.');
    if (!note) return null;
    if (note.trim().length < 10) {
      setError('Decision note must be at least 10 characters.');
      return null;
    }

    const lawEnforcementRef = reason.requiresLawEnforcementRef
      ? window.prompt('Police/legal reference required for this reason.')
      : undefined;
    if (reason.requiresLawEnforcementRef && !lawEnforcementRef?.trim()) {
      setError('Law enforcement reference is required for this decision.');
      return null;
    }

    return {
      reasonCode: reason.code,
      note: note.trim(),
      lawEnforcementRef: lawEnforcementRef?.trim() || undefined,
    };
  }

  async function onGig(gigId: string, decision: 'approve' | 'reject' | 'flag') {
    const payload = chooseDecisionPayload(`gig.${decision}` as AdminDecisionReasonAction);
    if (!payload) return;
    setActingId(gigId);
    try {
      await moderateGig(gigId, decision, payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gig moderation failed');
    } finally {
      setActingId(null);
    }
  }

  async function onReport(reportId: string, status: 'under_review' | 'action_taken' | 'escalated' | 'closed') {
    const payload = chooseDecisionPayload(`safety.${status}` as AdminDecisionReasonAction);
    if (!payload) return;
    setActingId(reportId);
    try {
      await reviewSafetyReport(reportId, status, payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Safety review failed');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="container wide">
      <div className="row">
        <div>
          <h1 className="page-title">Marketplace Safety</h1>
          <p className="page-sub">
            Signed in as {getOfficerName()} - review gigs and safety reports. Giver identity review happens in Didit.
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-outline" href="/safety">
            Safety ops
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

      <div className="tabs">
        <button className={tab === 'gigs' ? 'active' : ''} onClick={() => setTab('gigs')}>
          Gig review <span>{counts.gigs}</span>
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          Safety reports <span>{counts.reports}</span>
        </button>
      </div>

      {reasons && (
        <div className="meta-strip">
          Structured admin reasons loaded for {Object.keys(reasons).length} sensitive action sets.
        </div>
      )}

      {loading && <div className="empty">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && tab === 'gigs' && (
        <Queue
          empty="No gigs are waiting for approval."
          items={gigs.map((gig) => (
            <div className="card" key={gig.id}>
              <div className="row align-start">
                <div>
                  <div className="label">Gig</div>
                  <div className="display compact">{gig.title}</div>
                  <div className="muted">
                    {gig.id} - giver {gig.giverId} - {gig.location} - INR {gig.budgetAmount}
                  </div>
                  <p className="body-copy">{gig.description}</p>
                  <div className="signals">
                    <span className={`pill ${gig.riskLevel === 'high' ? 'bad' : 'warn'}`}>{gig.riskLevel}</span>
                    {gig.safetyFlags.map((flag) => (
                      <span className="pill warn" key={flag}>{flag}</span>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-primary" disabled={actingId === gig.id} onClick={() => void onGig(gig.id, 'approve')}>
                    Approve
                  </button>
                  <button className="btn btn-outline" disabled={actingId === gig.id} onClick={() => void onGig(gig.id, 'flag')}>
                    Flag
                  </button>
                  <button className="btn btn-danger" disabled={actingId === gig.id} onClick={() => void onGig(gig.id, 'reject')}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        />
      )}

      {!loading && tab === 'reports' && (
        <Queue
          empty="No open safety reports."
          items={reports.map((report) => (
            <div className="card" key={report.id}>
              <div className="row align-start">
                <div>
                  <div className="label">Safety report</div>
                  <div className="display compact">{report.reason}</div>
                  <div className="muted">
                    {report.id} - gig {report.gigId} - reporter {report.reporterId}
                  </div>
                  <p className="body-copy">{report.description}</p>
                  <div className="signals">
                    <span className={`pill ${['high', 'critical'].includes(report.severity) ? 'bad' : 'warn'}`}>
                      {report.severity}
                    </span>
                    <span className="signal">Evidence refs <b>{report.evidenceVaultRefs.length}</b></span>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void onReport(report.id, 'under_review')}>
                    Review
                  </button>
                  <button className="btn btn-primary" disabled={actingId === report.id} onClick={() => void onReport(report.id, 'action_taken')}>
                    Action
                  </button>
                  <button className="btn btn-danger" disabled={actingId === report.id} onClick={() => void onReport(report.id, 'escalated')}>
                    Escalate
                  </button>
                </div>
              </div>
            </div>
          ))}
        />
      )}
    </div>
  );
}

function Queue({ empty, items }: { empty: string; items: ReactNode[] }) {
  if (items.length === 0) return <div className="card empty">{empty}</div>;
  return <>{items}</>;
}
