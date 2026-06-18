'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AdminGig,
  clearSession,
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
      const [gigItems, reportItems] = await Promise.all([
        listReviewGigs(),
        listOpenSafetyReports(),
      ]);
      setGigs(gigItems);
      setReports(reportItems);
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

  async function onGig(gigId: string, decision: 'approve' | 'reject' | 'flag') {
    const reason = window.prompt('Moderation reason?');
    if (!reason) return;
    setActingId(gigId);
    try {
      await moderateGig(gigId, decision, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gig moderation failed');
    } finally {
      setActingId(null);
    }
  }

  async function onReport(reportId: string, status: 'under_review' | 'action_taken' | 'escalated' | 'closed') {
    const actionTaken = window.prompt('Action taken / case note?');
    if (!actionTaken) return;
    const lawRef = status === 'escalated' ? window.prompt('Police/legal reference?') ?? undefined : undefined;
    setActingId(reportId);
    try {
      await reviewSafetyReport(reportId, status, actionTaken, lawRef);
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
