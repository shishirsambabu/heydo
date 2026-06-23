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
  deactivateGiverFromSafetyReport,
  DisputeResolutionOutcome,
  generateEscalationPackage,
  getGigAuditTrail,
  getGigMoneyTrail,
  getDecisionReasons,
  getOfficerName,
  getToken,
  getSafetyReportAuditTrail,
  listSafetyReportEvidenceRefs,
  listActiveSafetyReports,
  listReviewGigs,
  moderateGig,
  resolveSafetyDispute,
  reviewSafetyReport,
  SafetyReport,
} from '../../lib/api';

type QueueTab = 'gigs' | 'reports';
type ContextRow = { label: string; value: string };
type ContextPanel = { title: string; rows: ContextRow[] };

export default function MarketplaceSafetyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<QueueTab>('gigs');
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [reasons, setReasons] = useState<AdminDecisionReasonCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contextPanel, setContextPanel] = useState<ContextPanel | null>(null);
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
    setNotice(null);
    setContextPanel(null);
    try {
      const [gigItems, reportItems, reasonCatalog] = await Promise.all([
        listReviewGigs(),
        listActiveSafetyReports(),
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
    setError(null);
    setNotice(null);
    setContextPanel(null);
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
    setError(null);
    setNotice(null);
    setContextPanel(null);
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

  async function onDispute(reportId: string, outcome: DisputeResolutionOutcome) {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const payload = chooseDecisionPayload(`dispute.${outcome}` as AdminDecisionReasonAction);
    if (!payload) return;
    setActingId(reportId);
    try {
      await resolveSafetyDispute(reportId, outcome, payload);
      await load();
      setNotice('Dispute outcome recorded. Escrow action is auditable in the money trail.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispute resolution failed');
    } finally {
      setActingId(null);
    }
  }

  async function onEscalationPackage(reportId: string) {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const payload = chooseDecisionPayload('escalation.generate');
    if (!payload) return;
    setActingId(reportId);
    try {
      const pkg = await generateEscalationPackage(reportId, payload);
      setNotice(`Escalation package ${pkg.id} generated and integrity verified: ${pkg.integrity.verified ? 'yes' : 'no'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Escalation package failed');
    } finally {
      setActingId(null);
    }
  }

  async function onDeactivateGiver(reportId: string) {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const payload = chooseDecisionPayload('giver.deactivate_abusive');
    if (!payload) return;
    const confirmed = window.confirm(
      'Deactivate this gig giver and quarantine their open gigs? This is a high-impact safety action.',
    );
    if (!confirmed) return;
    setActingId(reportId);
    try {
      await deactivateGiverFromSafetyReport(reportId, payload);
      await load();
      setNotice('Giver deactivated. Open gigs were quarantined and active gig lifecycle is locked for safety review.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Giver deactivation failed');
    } finally {
      setActingId(null);
    }
  }

  async function showGigMoneyTrail(gigId: string) {
    setError(null);
    setNotice(null);
    setActingId(gigId);
    try {
      const trail = await getGigMoneyTrail(gigId);
      const rows: ContextRow[] = [
        { label: 'Escrow hold', value: trail.hold ? `${trail.hold.status} - INR ${trail.hold.amount}` : 'No escrow hold yet' },
        { label: 'Transactions', value: String(trail.transactions.length) },
        ...trail.transactions.flatMap((item) => [
          {
            label: item.transaction.type,
            value: `${item.transaction.status} - ${item.transaction.createdAt}`,
          },
          {
            label: 'Postings',
            value: item.postings
              .map((posting) => `${posting.direction} INR ${posting.amount} ${posting.account?.type ?? posting.accountId}`)
              .join('; ') || 'No postings',
          },
        ]),
      ];
      setContextPanel({ title: `Money trail for ${gigId}`, rows });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Money trail failed');
    } finally {
      setActingId(null);
    }
  }

  async function showGigAuditTrail(gigId: string) {
    setError(null);
    setNotice(null);
    setActingId(gigId);
    try {
      const records = await getGigAuditTrail(gigId);
      setContextPanel({
        title: `Gig audit trail for ${gigId}`,
        rows: records.map((record) => ({
          label: record.action,
          value: `${record.at} - ${record.actorRole}:${record.actorId} - ${summarizeMetadata(record.metadata)}`,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gig audit trail failed');
    } finally {
      setActingId(null);
    }
  }

  async function showReportAuditTrail(reportId: string) {
    setError(null);
    setNotice(null);
    setActingId(reportId);
    try {
      const records = await getSafetyReportAuditTrail(reportId);
      setContextPanel({
        title: `Safety report audit trail for ${reportId}`,
        rows: records.map((record) => ({
          label: record.action,
          value: `${record.at} - ${record.actorRole}:${record.actorId} - ${summarizeMetadata(record.metadata)}`,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report audit trail failed');
    } finally {
      setActingId(null);
    }
  }

  async function showEvidenceRefs(reportId: string) {
    setError(null);
    setNotice(null);
    setActingId(reportId);
    try {
      const refs = await listSafetyReportEvidenceRefs(reportId);
      setContextPanel({
        title: `Evidence refs for ${reportId}`,
        rows: refs.map((ref) => ({
          label: ref.classification,
          value: `${ref.ref} - ${ref.retentionPolicy}${ref.legalHold ? ' - legal hold' : ''} - accessed ${ref.accessCount} times`,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evidence refs failed');
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
      {notice && <div className="notice">{notice}</div>}
      {contextPanel && <ContextPanelView panel={contextPanel} />}

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
                  <button className="btn btn-outline" disabled={actingId === gig.id} onClick={() => void showGigAuditTrail(gig.id)}>
                    Audit
                  </button>
                  <button className="btn btn-outline" disabled={actingId === gig.id} onClick={() => void showGigMoneyTrail(gig.id)}>
                    Money
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
                    {report.reportedUserId ? ` - reported ${report.reportedUserId}` : ''}
                  </div>
                  <p className="body-copy">{report.description}</p>
                  <div className="signals">
                    <span className={`pill ${['high', 'critical'].includes(report.severity) ? 'bad' : 'warn'}`}>
                      {report.severity}
                    </span>
                    <span className="pill warn">{report.status}</span>
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
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void onReport(report.id, 'closed')}>
                    Close
                  </button>
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void onDispute(report.id, 'release_to_worker')}>
                    Pay worker
                  </button>
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void onDispute(report.id, 'refund_giver')}>
                    Refund giver
                  </button>
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void onDispute(report.id, 'keep_escalated')}>
                    Keep escalated
                  </button>
                  <button className="btn btn-danger" disabled={actingId === report.id} onClick={() => void onEscalationPackage(report.id)}>
                    Package
                  </button>
                  {report.reportedUserId && (
                    <button className="btn btn-danger" disabled={actingId === report.id} onClick={() => void onDeactivateGiver(report.id)}>
                      Deactivate giver
                    </button>
                  )}
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void showEvidenceRefs(report.id)}>
                    Evidence
                  </button>
                  <button className="btn btn-outline" disabled={actingId === report.id} onClick={() => void showReportAuditTrail(report.id)}>
                    Audit
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

function ContextPanelView({ panel }: { panel: ContextPanel }) {
  return (
    <div className="card context-panel">
      <div className="row">
        <div>
          <div className="label">Decision context</div>
          <div className="display compact">{panel.title}</div>
        </div>
      </div>
      <div className="mini-table">
        {panel.rows.length === 0 ? (
          <div className="muted">No records found.</div>
        ) : (
          panel.rows.map((row, index) => (
            <div className="mini-row context-row" key={`${row.label}-${index}`}>
              <div>{row.label}</div>
              <div>{row.value}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function summarizeMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return 'no metadata';
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${formatMetadataValue(value)}`)
    .join(', ');
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(',')}]`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
