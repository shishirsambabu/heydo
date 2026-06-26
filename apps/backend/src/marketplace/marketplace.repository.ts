import {
  Assignment,
  Category,
  DEFAULT_CATEGORIES,
  EscalationPackageManifest,
  EvidenceVaultRef,
  Gig,
  GigApplication,
  Rating,
  RatingDirection,
  SafetyReport,
} from './marketplace.entities';

export interface GigFilters {
  status?: string;
  categoryId?: string;
  visibilityStatus?: string;
  giverId?: string;
}

export interface CategoryRepository {
  listActive(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
}

export interface GigRepository {
  save(gig: Gig): Promise<void>;
  findById(id: string): Promise<Gig | null>;
  list(filters?: GigFilters): Promise<Gig[]>;
}

export interface ApplicationRepository {
  save(application: GigApplication): Promise<void>;
  findById(id: string): Promise<GigApplication | null>;
  findByGigAndWorker(gigId: string, workerId: string): Promise<GigApplication | null>;
  listForGig(gigId: string): Promise<GigApplication[]>;
  listForWorker(workerId: string): Promise<GigApplication[]>;
}

export interface AssignmentRepository {
  save(assignment: Assignment): Promise<void>;
  findByGig(gigId: string): Promise<Assignment | null>;
}

export interface ProposalTokenAccount {
  workerId: string;
  balance: number;
  updatedAt: string;
}

export interface ProposalTokenRepository {
  ensureAccount(workerId: string, initialBalance: number, now: string): Promise<ProposalTokenAccount>;
  debit(workerId: string, amount: number, now: string): Promise<ProposalTokenAccount | null>;
}

export interface RatingRepository {
  save(rating: Rating): Promise<void>;
  findByGigAndDirection(gigId: string, direction: RatingDirection): Promise<Rating | null>;
  listForGig(gigId: string): Promise<Rating[]>;
  listForRatee(rateeId: string, direction: RatingDirection): Promise<Rating[]>;
  listAtOrBelowStars(maxStars: number): Promise<Rating[]>;
}

export interface SafetyReportRepository {
  save(report: SafetyReport): Promise<void>;
  findById(id: string): Promise<SafetyReport | null>;
  list(filters?: { status?: string; gigId?: string }): Promise<SafetyReport[]>;
}

export interface EvidenceVaultRefRepository {
  save(ref: EvidenceVaultRef): Promise<void>;
  findByRef(ref: string): Promise<EvidenceVaultRef | null>;
  listForReport(reportId: string): Promise<EvidenceVaultRef[]>;
  markAccessed(ref: string, actorId: string, at: string): Promise<EvidenceVaultRef | null>;
}

export interface EscalationPackageRepository {
  save(manifest: EscalationPackageManifest): Promise<void>;
  findById(id: string): Promise<EscalationPackageManifest | null>;
  markRetrieved(id: string, actorId: string, at: string): Promise<EscalationPackageManifest | null>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
export const GIG_REPOSITORY = Symbol('GIG_REPOSITORY');
export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');
export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');
export const PROPOSAL_TOKEN_REPOSITORY = Symbol('PROPOSAL_TOKEN_REPOSITORY');
export const RATING_REPOSITORY = Symbol('RATING_REPOSITORY');
export const SAFETY_REPORT_REPOSITORY = Symbol('SAFETY_REPORT_REPOSITORY');
export const EVIDENCE_VAULT_REF_REPOSITORY = Symbol('EVIDENCE_VAULT_REF_REPOSITORY');
export const ESCALATION_PACKAGE_REPOSITORY = Symbol('ESCALATION_PACKAGE_REPOSITORY');

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category]));

  async listActive(): Promise<Category[]> {
    return [...this.items.values()]
      .filter((category) => category.active)
      .map((category) => ({ ...category }));
  }

  async findById(id: string): Promise<Category | null> {
    const category = this.items.get(id);
    return category ? { ...category } : null;
  }

  async save(category: Category): Promise<void> {
    this.items.set(category.id, { ...category });
  }
}

export class InMemoryGigRepository implements GigRepository {
  private readonly items = new Map<string, Gig>();

  async save(gig: Gig): Promise<void> {
    this.items.set(gig.id, { ...gig });
  }

  async findById(id: string): Promise<Gig | null> {
    const gig = this.items.get(id);
    return gig ? { ...gig } : null;
  }

  async list(filters: GigFilters = {}): Promise<Gig[]> {
    return [...this.items.values()]
      .filter((gig) => !filters.status || gig.status === filters.status)
      .filter((gig) => !filters.categoryId || gig.categoryId === filters.categoryId)
      .filter((gig) => !filters.visibilityStatus || gig.visibilityStatus === filters.visibilityStatus)
      .filter((gig) => !filters.giverId || gig.giverId === filters.giverId)
      .map((gig) => ({ ...gig }))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly items = new Map<string, GigApplication>();

  async save(application: GigApplication): Promise<void> {
    this.items.set(application.id, { ...application });
  }

  async findById(id: string): Promise<GigApplication | null> {
    const application = this.items.get(id);
    return application ? { ...application } : null;
  }

  async findByGigAndWorker(gigId: string, workerId: string): Promise<GigApplication | null> {
    const application = [...this.items.values()].find(
      (item) => item.gigId === gigId && item.workerId === workerId,
    );
    return application ? { ...application } : null;
  }

  async listForGig(gigId: string): Promise<GigApplication[]> {
    return [...this.items.values()]
      .filter((application) => application.gigId === gigId)
      .map((application) => ({ ...application }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listForWorker(workerId: string): Promise<GigApplication[]> {
    return [...this.items.values()]
      .filter((application) => application.workerId === workerId)
      .map((application) => ({ ...application }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private readonly byGig = new Map<string, Assignment>();

  async save(assignment: Assignment): Promise<void> {
    this.byGig.set(assignment.gigId, { ...assignment });
  }

  async findByGig(gigId: string): Promise<Assignment | null> {
    const assignment = this.byGig.get(gigId);
    return assignment ? { ...assignment } : null;
  }
}

export class InMemoryProposalTokenRepository implements ProposalTokenRepository {
  private readonly items = new Map<string, ProposalTokenAccount>();

  async ensureAccount(workerId: string, initialBalance: number, now: string): Promise<ProposalTokenAccount> {
    const existing = this.items.get(workerId);
    if (existing) return { ...existing };
    const account = { workerId, balance: initialBalance, updatedAt: now };
    this.items.set(workerId, account);
    return { ...account };
  }

  async debit(workerId: string, amount: number, now: string): Promise<ProposalTokenAccount | null> {
    const existing = this.items.get(workerId);
    if (!existing || existing.balance < amount) return null;
    const updated = { ...existing, balance: existing.balance - amount, updatedAt: now };
    this.items.set(workerId, updated);
    return { ...updated };
  }
}

export class InMemoryRatingRepository implements RatingRepository {
  private readonly items = new Map<string, Rating>();

  async save(rating: Rating): Promise<void> {
    this.items.set(`${rating.gigId}:${rating.direction}`, copyRating(rating));
  }

  async findByGigAndDirection(
    gigId: string,
    direction: RatingDirection,
  ): Promise<Rating | null> {
    const rating = this.items.get(`${gigId}:${direction}`);
    return rating ? copyRating(rating) : null;
  }

  async listForGig(gigId: string): Promise<Rating[]> {
    return [...this.items.values()]
      .filter((rating) => rating.gigId === gigId)
      .map(copyRating)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listForRatee(rateeId: string, direction: RatingDirection): Promise<Rating[]> {
    return [...this.items.values()]
      .filter((rating) => rating.rateeId === rateeId && rating.direction === direction)
      .map(copyRating)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listAtOrBelowStars(maxStars: number): Promise<Rating[]> {
    return [...this.items.values()]
      .filter((rating) => rating.stars <= maxStars)
      .map(copyRating)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemorySafetyReportRepository implements SafetyReportRepository {
  private readonly items = new Map<string, SafetyReport>();

  async save(report: SafetyReport): Promise<void> {
    this.items.set(report.id, { ...report, evidenceVaultRefs: [...report.evidenceVaultRefs] });
  }

  async findById(id: string): Promise<SafetyReport | null> {
    const report = this.items.get(id);
    return report ? { ...report, evidenceVaultRefs: [...report.evidenceVaultRefs] } : null;
  }

  async list(filters: { status?: string; gigId?: string } = {}): Promise<SafetyReport[]> {
    return [...this.items.values()]
      .filter((report) => !filters.status || report.status === filters.status)
      .filter((report) => !filters.gigId || report.gigId === filters.gigId)
      .map((report) => ({ ...report, evidenceVaultRefs: [...report.evidenceVaultRefs] }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemoryEvidenceVaultRefRepository implements EvidenceVaultRefRepository {
  private readonly items = new Map<string, EvidenceVaultRef>();

  async save(ref: EvidenceVaultRef): Promise<void> {
    this.items.set(ref.ref, copyEvidenceVaultRef(ref));
  }

  async findByRef(ref: string): Promise<EvidenceVaultRef | null> {
    const item = this.items.get(ref);
    return item ? copyEvidenceVaultRef(item) : null;
  }

  async listForReport(reportId: string): Promise<EvidenceVaultRef[]> {
    return [...this.items.values()]
      .filter((item) => item.reportId === reportId)
      .map(copyEvidenceVaultRef)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async markAccessed(ref: string, actorId: string, at: string): Promise<EvidenceVaultRef | null> {
    const item = this.items.get(ref);
    if (!item) return null;
    const updated: EvidenceVaultRef = {
      ...item,
      accessCount: item.accessCount + 1,
      lastAccessedBy: actorId,
      lastAccessedAt: at,
    };
    this.items.set(ref, copyEvidenceVaultRef(updated));
    return copyEvidenceVaultRef(updated);
  }
}

export class InMemoryEscalationPackageRepository implements EscalationPackageRepository {
  private readonly items = new Map<string, EscalationPackageManifest>();

  async save(manifest: EscalationPackageManifest): Promise<void> {
    this.items.set(manifest.id, copyEscalationPackageManifest(manifest));
  }

  async findById(id: string): Promise<EscalationPackageManifest | null> {
    const manifest = this.items.get(id);
    return manifest ? copyEscalationPackageManifest(manifest) : null;
  }

  async markRetrieved(
    id: string,
    actorId: string,
    at: string,
  ): Promise<EscalationPackageManifest | null> {
    const manifest = this.items.get(id);
    if (!manifest) return null;
    const updated: EscalationPackageManifest = {
      ...manifest,
      retrievalCount: manifest.retrievalCount + 1,
      lastRetrievedBy: actorId,
      lastRetrievedAt: at,
    };
    this.items.set(id, copyEscalationPackageManifest(updated));
    return copyEscalationPackageManifest(updated);
  }
}

function copyRating(rating: Rating): Rating {
  return {
    ...rating,
    tags: [...rating.tags],
  };
}

function copyEvidenceVaultRef(ref: EvidenceVaultRef): EvidenceVaultRef {
  return {
    ...ref,
    allowedRoles: [...ref.allowedRoles],
  };
}

function copyEscalationPackageManifest(
  manifest: EscalationPackageManifest,
): EscalationPackageManifest {
  return {
    ...manifest,
    evidenceVaultRefs: [...manifest.evidenceVaultRefs],
  };
}
