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
  closePhaseGate,
  clearSession,
  deactivateGiverFromSafetyReport,
  DisputeResolutionOutcome,
  generateEscalationPackage,
  getGigAuditTrail,
  getGigMoneyTrail,
  getDecisionReasons,
  getMarketplaceEconomics,
  getOfficerName,
  getOperatorPolicyMatrix,
  getPhaseGateStatus,
  getProposalTokenAuditTrail,
  getToken,
  getSafetyReportAuditTrail,
  grantProposalTokens,
  listLowRatingReviews,
  listPhaseGateEvidence,
  listSafetyReportEvidenceRefs,
  listActiveSafetyReports,
  listReviewGigs,
  MarketplaceEconomicsSummary,
  moderateGig,
  openSafetyReportFromRating,
  OperatorPolicyMatrixEntry,
  PhaseGateEvidenceCode,
  PhaseGateStatus,
  RatingReviewItem,
  recordPhaseGateEvidence,
  resolveSafetyDispute,
  reviewSafetyReport,
  SafetyReport,
  suspendWorkerFromSafetyReport,
} from '../../lib/api';

type QueueTab = 'gigs' | 'ratings' | 'reports';
type ContextRow = { label: string; value: string };
type ContextPanel = { title: string; rows: ContextRow[] };

const PHASE_GATE_EVIDENCE_OPTIONS: PhaseGateEvidenceCode[] = [
  'didit_worker_live',
  'didit_giver_live',
  'didit_callback_approved',
  'didit_callback_declined',
  'flutter_mobile_qa',
  'durable_backend',
];

const PROJECT_METER = {
  overall: 61,
  activeGate: 76,
  gateName: 'Phase 2 applicant marketplace',
  proof: 'Local Phase 2 smoke passed, Flutter mobile QA passes analyze/widget tests, and Android tooling is doctor-green.',
  nextGate: 'Repeat the passed applicant flow through Flutter on a real Android device in Malayalam, then record Flutter QA evidence.',
  blockers: [
    'Run the giver post, 3 worker applications, selection, lifecycle, and dual-rating flow on Android',
    'Confirm Malayalam copy and low-connectivity behavior during the mobile run',
    'Confirm admin category/listing moderation and marketplace health visibility during mobile QA',
    'Deploy durable backend URL and pass npm run deploy:readiness',
  ],
};

export default function MarketplaceSafetyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<QueueTab>('gigs');
  const [gigs, setGigs] = useState<AdminGig[]>([]);
  const [ratings, setRatings] = useState<RatingReviewItem[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [economics, setEconomics] = useState<MarketplaceEconomicsSummary | null>(null);
  const [reasons, setReasons] = useState<AdminDecisionReasonCatalog | null>(null);
  const [policyMatrix, setPolicyMatrix] = useState<OperatorPolicyMatrixEntry[]>([]);
  const [phaseGateStatus, setPhaseGateStatus] = useState<PhaseGateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contextPanel, setContextPanel] = useState<ContextPanel | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [officerName, setOfficerName] = useState('officer');

  const counts = useMemo(
    () => ({
      gigs: gigs.length,
      ratings: ratings.length,
      reports: reports.length,
    }),
    [gigs.length, ratings.length, reports.length],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setContextPanel(null);
    try {
      const [
        gigItems,
        ratingItems,
        reportItems,
        economicsSummary,
        reasonCatalog,
        policyItems,
        gateStatus,
      ] = await Promise.all([
          listReviewGigs(),
          listLowRatingReviews(),
          listActiveSafetyReports(),
          getMarketplaceEconomics(),
          getDecisionReasons(),
          getOperatorPolicyMatrix(),
          getPhaseGateStatus(),
        ]);
      setGigs(gigItems);
      setRatings(ratingItems);
      setReports(reportItems);
      setEconomics(economicsSummary);
      setReasons(reasonCatalog);
      setPolicyMatrix(policyItems);
      setPhaseGateStatus(gateStatus);
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
    setOfficerName(getOfficerName());
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

  async function onSuspendWorker(reportId: string) {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const payload = chooseDecisionPayload('worker.suspend_abusive');
    if (!payload) return;
    const confirmed = window.confirm(
      'Suspend this worker, withdraw pending applications, and lock active gigs for safety review?',
    );
    if (!confirmed) return;
    setActingId(reportId);
    try {
      await suspendWorkerFromSafetyReport(reportId, payload);
      await load();
      setNotice('Worker suspended. Pending applications were withdrawn and active gigs were locked for safety review.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Worker suspension failed');
    } finally {
      setActingId(null);
    }
  }

  async function onGrantProposalTokens() {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const workerId = window.prompt('Worker user id?');
    if (!workerId?.trim()) return;
    const amountText = window.prompt('Proposal tokens to grant? Maximum 100.');
    if (!amountText) return;
    const amount = Number(amountText.trim());
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      setError('Grant amount must be a whole number from 1 to 100.');
      return;
    }
    const payload = chooseDecisionPayload('proposal_tokens.grant');
    if (!payload) return;
    const confirmed = window.confirm(
      `Grant ${amount} proposal tokens to ${workerId.trim()}? This is an audited finance action.`,
    );
    if (!confirmed) return;
    setActingId(`proposal-token-grant:${workerId.trim()}`);
    try {
      const account = await grantProposalTokens(workerId.trim(), amount, payload);
      await load();
      setNotice(`Granted ${amount} proposal tokens to ${account.workerId}. New balance: ${account.balance}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proposal token grant failed');
    } finally {
      setActingId(null);
    }
  }

  async function onRecordPhaseGateEvidence() {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const menu = PHASE_GATE_EVIDENCE_OPTIONS.map((code, index) => `${index + 1}. ${code}`).join('\n');
    const selected = window.prompt(`Evidence type:\n${menu}`);
    if (!selected) return;
    const gateCode =
      PHASE_GATE_EVIDENCE_OPTIONS[Number(selected.trim()) - 1] ??
      PHASE_GATE_EVIDENCE_OPTIONS.find((code) => code === selected.trim());
    if (!gateCode) {
      setError('Choose a valid evidence type number or code.');
      return;
    }
    const evidenceRef = window.prompt('Evidence reference? Example: didit-session:abc123 or qa-run:2026-06-27');
    if (!evidenceRef?.trim()) return;
    const note = window.prompt('Evidence note? Minimum 10 characters.');
    if (!note?.trim() || note.trim().length < 10) {
      setError('Evidence note must be at least 10 characters.');
      return;
    }
    setActingId(`phase-gate-evidence:${gateCode}`);
    try {
      await recordPhaseGateEvidence(gateCode, evidenceRef.trim(), note.trim());
      setNotice(`Recorded phase-gate evidence: ${gateCode}.`);
      await showPhaseGateEvidence();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phase-gate evidence recording failed');
    } finally {
      setActingId(null);
    }
  }

  async function showPhaseGateEvidence() {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    setActingId('phase-gate-evidence:list');
    try {
      const trail = await listPhaseGateEvidence();
      setContextPanel({
        title: 'Pre-Phase-2 gate evidence',
        rows: trail.map((entry) => ({
          label: `${entry.action.replace('phase_gate.evidence_recorded.', '')} - ${entry.at}`,
          value: summarizeMetadata(entry.metadata),
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phase-gate evidence lookup failed');
    } finally {
      setActingId(null);
    }
  }

  async function onClosePhaseGate() {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    if (phaseGateStatus?.closed) {
      setError(`Gate already closed${phaseGateStatus.closedAt ? ` at ${phaseGateStatus.closedAt}` : ''}.`);
      return;
    }
    if (!phaseGateStatus?.canClosePrePhase2Gate) {
      setError(
        `Cannot close gate yet. Missing: ${phaseGateStatus?.requiredMissing.join(', ') || 'required evidence'}.`,
      );
      return;
    }
    const note = window.prompt('Close pre-Phase-2 safety gate note? Minimum 10 characters.');
    if (!note?.trim() || note.trim().length < 10) {
      setError('Close-gate note must be at least 10 characters.');
      return;
    }
    const confirmed = window.confirm(
      'Close the pre-Phase-2 safety hardening gate? This records an auditable launch-readiness decision.',
    );
    if (!confirmed) return;
    setActingId('phase-gate:close');
    try {
      await closePhaseGate(note.trim());
      await load();
      setNotice('Pre-Phase-2 safety hardening gate closed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phase-gate close failed');
    } finally {
      setActingId(null);
    }
  }

  async function showProposalTokenAuditTrail() {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const workerId = window.prompt('Worker user id?');
    if (!workerId?.trim()) return;
    const id = workerId.trim();
    setActingId(`proposal-token-audit:${id}`);
    try {
      const records = await getProposalTokenAuditTrail(id);
      setContextPanel({
        title: `Proposal token audit for ${id}`,
        rows: records.map((record) => ({
          label: record.action,
          value: `${record.at} - ${record.actorRole}:${record.actorId} - ${summarizeMetadata(record.metadata)}`,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proposal token audit failed');
    } finally {
      setActingId(null);
    }
  }

  async function onRatingSafetyCase(item: RatingReviewItem) {
    setError(null);
    setNotice(null);
    setContextPanel(null);
    const note = window.prompt(
      'Why should this low rating become a formal safety case? Minimum 10 characters.',
    );
    if (!note) return;
    if (note.trim().length < 10) {
      setError('Safety case note must be at least 10 characters.');
      return;
    }
    const confirmed = window.confirm(
      'Open a formal safety report linked to this rating? The rating will leave this queue.',
    );
    if (!confirmed) return;
    setActingId(item.rating.id);
    try {
      const report = await openSafetyReportFromRating(
        item.gig.id,
        item.rating.direction,
        note.trim(),
      );
      await load();
      setTab('reports');
      setNotice(`Safety report ${report.id} opened from rating ${item.rating.id}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Safety case creation failed');
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
            Signed in as {officerName} - review gigs and safety reports. Giver identity review happens in Didit.
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
          <button className="btn btn-outline" onClick={() => void onGrantProposalTokens()}>
            Grant tokens
          </button>
          <button className="btn btn-outline" onClick={() => void showProposalTokenAuditTrail()}>
            Token audit
          </button>
          <button className="btn btn-outline" onClick={() => void onRecordPhaseGateEvidence()}>
            Record gate
          </button>
          <button className="btn btn-outline" onClick={() => void showPhaseGateEvidence()}>
            Gate evidence
          </button>
          <button className="btn btn-outline" onClick={() => void onClosePhaseGate()}>
            Close gate
          </button>
          <button className="btn btn-outline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <ProjectCompletionMeter
        overall={PROJECT_METER.overall}
        activeGate={PROJECT_METER.activeGate}
        gateName={PROJECT_METER.gateName}
        proof={PROJECT_METER.proof}
        nextGate={PROJECT_METER.nextGate}
        blockers={PROJECT_METER.blockers}
        counts={counts}
        gateStatus={phaseGateStatus}
      />

      <div className="tabs">
        <button className={tab === 'gigs' ? 'active' : ''} onClick={() => setTab('gigs')}>
          Gig review <span>{counts.gigs}</span>
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          Safety reports <span>{counts.reports}</span>
        </button>
        <button className={tab === 'ratings' ? 'active' : ''} onClick={() => setTab('ratings')}>
          Low ratings <span>{counts.ratings}</span>
        </button>
      </div>

      {reasons && (
        <div className="meta-strip">
          Structured admin reasons loaded for {Object.keys(reasons).length} sensitive action sets.
        </div>
      )}

      {economics && (
        <div className="meta-strip">
          GMV INR {economics.grossBookingValueAmount} · Platform fee INR {economics.platformFeeAmount} ({economics.commissionBps / 100}%) · Worker payout INR {economics.workerPayoutAmount} · Proposal tokens {economics.proposalTokenCount} = modeled INR {economics.modeledProposalTokenRevenueAmount}
        </div>
      )}

      {policyMatrix.length > 0 && <OperatorPolicyPanel items={policyMatrix} />}

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
                    {gig.id} - giver {gig.giverId} - {gig.location} - {gig.categoryNameEn ?? gig.categoryId}
                  </div>
                  <p className="body-copy">{gig.description}</p>
                  <div className="signals">
                    <span className={`pill ${gig.riskLevel === 'high' ? 'bad' : 'warn'}`}>{gig.riskLevel}</span>
                    <span className={`pill ${gig.pricingAssessment === 'below_fair_minimum' ? 'bad' : gig.pricingAssessment === 'above_high_review' ? 'warn' : 'ok'}`}>
                      {formatStatusLabel(gig.pricingAssessment ?? 'missing_guide')}
                    </span>
                    <span className="signal">Budget <b>INR {gig.budgetAmount}</b></span>
                    {gig.pricingGuide && (
                      <span className="signal">
                        Fair min <b>INR {gig.pricingGuide.minBudgetAmount}</b>
                        {' / '}
                        suggested <b>INR {gig.pricingGuide.suggestedBudgetAmount}</b>
                        {' / '}
                        high review <b>INR {gig.pricingGuide.highReviewAmount}</b>
                      </span>
                    )}
                    {gig.safetyFlags.map((flag) => (
                      <span className="pill warn" key={flag}>{flag}</span>
                    ))}
                  </div>
                  {gig.pricingGuide && <p className="muted">{gig.pricingGuide.notes}</p>}
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
                    <span className="pill">{formatStatusLabel(report.reportedUserRole ?? 'unknown')}</span>
                    {report.reportedUserStatus && (
                      <span className={`pill ${report.reportedUserStatus.includes('suspended') || report.reportedUserStatus.includes('deactivated') ? 'bad' : ''}`}>
                        Account {formatStatusLabel(report.reportedUserStatus)}
                      </span>
                    )}
                    {report.reportedUserVerificationStatus && (
                      <span className="signal">KYC <b>{formatStatusLabel(report.reportedUserVerificationStatus)}</b></span>
                    )}
                    <span className={`signal ${(report.reportedUserHighSeverityReportCount ?? 0) > 0 ? 'warn-text' : ''}`}>
                      Target reports <b>{report.reportedUserReportCount ?? 0}</b>
                      {' / '}
                      high <b>{report.reportedUserHighSeverityReportCount ?? 0}</b>
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
                  {report.reportedUserRole === 'giver' && (
                    <button className="btn btn-danger" disabled={actingId === report.id} onClick={() => void onDeactivateGiver(report.id)}>
                      Deactivate giver
                    </button>
                  )}
                  {report.reportedUserRole === 'worker' && (
                    <button className="btn btn-danger" disabled={actingId === report.id} onClick={() => void onSuspendWorker(report.id)}>
                      Suspend worker
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

      {!loading && tab === 'ratings' && (
        <Queue
          empty="No low ratings are waiting for safety triage."
          items={ratings.map((item) => {
            const reputation =
              item.rating.direction === 'worker_to_giver'
                ? item.rateeReputation.asGiver
                : item.rateeReputation.asWorker;
            return (
              <div className="card" key={item.rating.id}>
                <div className="row align-start">
                  <div>
                    <div className="label">
                      {item.rating.direction === 'worker_to_giver'
                        ? 'Worker rated giver'
                        : 'Giver rated worker'}
                    </div>
                    <div className="display compact">
                      {item.rating.stars} star{item.rating.stars === 1 ? '' : 's'} - {item.gig.title}
                    </div>
                    <div className="muted">
                      {item.rating.id} - gig {item.gig.id} - rated user {item.rating.rateeId}
                    </div>
                    <div className="signals">
                      <span className={`pill ${item.rating.stars === 1 ? 'bad' : 'warn'}`}>
                        {item.rating.stars}/5
                      </span>
                      {item.rating.tags.map((tag) => (
                        <span className="pill warn" key={tag}>{tag}</span>
                      ))}
                      <span className="signal">Comment length <b>{item.rating.commentLength}</b></span>
                      <span className="signal">Ratings <b>{reputation.ratingCount}</b></span>
                      <span className="signal">
                        Heydo Score <b>{reputation.heydoScore ?? 'new'}</b>
                      </span>
                    </div>
                    <p className="body-copy">
                      {item.gig.location} - INR {item.gig.budgetAmount} - rated {item.rating.createdAt}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      className="btn btn-danger"
                      disabled={actingId === item.rating.id}
                      onClick={() => void onRatingSafetyCase(item)}
                    >
                      Open safety case
                    </button>
                    <button
                      className="btn btn-outline"
                      disabled={actingId === item.rating.id}
                      onClick={() => void showGigAuditTrail(item.gig.id)}
                    >
                      Gig audit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        />
      )}
    </div>
  );
}

function Queue({ empty, items }: { empty: string; items: ReactNode[] }) {
  if (items.length === 0) return <div className="card empty">{empty}</div>;
  return <>{items}</>;
}

function ProjectCompletionMeter({
  overall,
  activeGate,
  gateName,
  nextGate,
  proof,
  blockers,
  counts,
  gateStatus,
}: {
  overall: number;
  activeGate: number;
  gateName: string;
  nextGate: string;
  proof: string;
  blockers: string[];
  counts: Record<QueueTab, number>;
  gateStatus: PhaseGateStatus | null;
}) {
  const openQueueCount = counts.gigs + counts.reports + counts.ratings;
  const requiredCount = gateStatus?.requiredCodes.length ?? 0;
  const recordedRequiredCount = gateStatus
    ? gateStatus.requiredCodes.filter((code) => gateStatus.recordedCodes.includes(code)).length
    : 0;
  return (
    <section className="meter-panel" aria-labelledby="project-meter-title">
      <div className="meter-heading">
        <div>
          <div className="label">Project completion meter</div>
          <h2 id="project-meter-title">MVP launch readiness</h2>
        </div>
        <span className="pill warn">{gateName}</span>
      </div>

      <div className="meter-grid">
        <MeterStat label="Overall" value={overall} helper="Full MVP launch readiness" />
        <MeterStat label="Active gate" value={activeGate} helper="Applicant marketplace Phase 2" />
        <div className="meter-live">
          <div className="label">Live ops load</div>
          <div className={`stat-value ${openQueueCount > 0 ? 'warn' : 'ok'}`}>{openQueueCount}</div>
          <p className="muted">
            {counts.gigs} gigs, {counts.reports} reports, {counts.ratings} low ratings waiting.
          </p>
        </div>
      </div>

      {gateStatus && (
        <div className="gate-status">
          <div>
            <div className="label">Evidence status</div>
            <p>
              {recordedRequiredCount}/{requiredCount} required evidence items recorded.{' '}
              {gateStatus.closed
                ? `Pre-Phase-2 gate closed${gateStatus.closedAt ? ` at ${gateStatus.closedAt}` : ''}.`
                : gateStatus.canClosePrePhase2Gate
                  ? 'Pre-Phase-2 gate can be closed.'
                  : 'External evidence still pending.'}
            </p>
          </div>
          <div className="signals">
            {gateStatus.requiredMissing.map((code) => (
              <span className="pill warn" key={code}>{code}</span>
            ))}
            {gateStatus.closed && <span className="pill ok">gate closed</span>}
            {gateStatus.requiredMissing.length === 0 && <span className="pill ok">required evidence complete</span>}
          </div>
        </div>
      )}

      <div className="gate-status phase-proof">
        <div>
          <div className="label">Phase proof</div>
          <p>{proof}</p>
        </div>
        <span className="pill ok">local smoke passed</span>
      </div>

      <div className="meter-next">
        <div>
          <div className="label">Next gate</div>
          <p>{nextGate}</p>
        </div>
        <ul>
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MeterStat({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="meter-stat">
      <div className="meter-stat-top">
        <span className="label">{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div style={{ width: `${value}%` }} />
      </div>
      <p className="muted">{helper}</p>
    </div>
  );
}

function OperatorPolicyPanel({ items }: { items: OperatorPolicyMatrixEntry[] }) {
  const criticalItems = items.filter((item) => item.severity === 'critical');
  const visibleItems = [
    ...criticalItems,
    ...items.filter((item) => item.severity !== 'critical'),
  ].slice(0, 5);

  return (
    <section className="policy-panel" aria-labelledby="operator-policy-title">
      <div className="row align-start">
        <div>
          <div className="label">Operator policy matrix</div>
          <h2 id="operator-policy-title">Approve, flag, reject, or escalate</h2>
          <p className="muted">
            Use this before high-impact decisions. Evidence refs stay in the vault; lawful escalation packages use refs only.
          </p>
        </div>
        <span className="pill bad">{criticalItems.length} critical rules</span>
      </div>

      <div className="policy-grid">
        {visibleItems.map((item) => (
          <article className="policy-item" key={`${item.area}-${item.adminAction}`}>
            <div className="policy-item-top">
              <span className={`pill ${item.severity === 'critical' ? 'bad' : item.severity === 'high' ? 'warn' : 'ok'}`}>
                {item.severity}
              </span>
              <span className="label">{formatStatusLabel(item.adminAction)}</span>
            </div>
            <h3>{formatStatusLabel(item.area)}</h3>
            <p>{item.decisionRule}</p>
            <div className="muted">Trigger: {item.trigger}</div>
            <div className="muted">Escalation: {item.escalationPath}</div>
          </article>
        ))}
      </div>
    </section>
  );
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

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, ' ');
}
