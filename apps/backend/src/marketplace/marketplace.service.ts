import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { GiverProfileRepository } from '../identity/identity.repository';
import { VerificationService } from '../verification/verification.service';
import {
  Assignment,
  Category,
  Gig,
  GigApplication,
  GigStatus,
} from './marketplace.entities';
import {
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  ApplicationRepository,
  AssignmentRepository,
  CATEGORY_REPOSITORY,
  CategoryRepository,
  GIG_REPOSITORY,
  GigFilters,
  GigRepository,
} from './marketplace.repository';

export class MarketplaceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

export interface PostGigInput {
  categoryId: string;
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  budgetAmount: number;
}

export interface ApplyInput {
  messageMl?: string;
  proposedPrice?: number;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(GIG_REPOSITORY) private readonly gigs: GigRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    private readonly givers: GiverProfileRepository,
    private readonly verification: VerificationService,
    private readonly audit: AuditService,
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = randomId,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.categories.listActive();
  }

  async postGig(giverId: string, input: PostGigInput): Promise<Gig> {
    const giver = await this.givers.findByUser(giverId);
    if (!giver || giver.status !== 'active') {
      throw new MarketplaceError('Active giver profile required', 'giver_required');
    }
    const category = await this.categories.findById(input.categoryId);
    if (!category?.active) {
      throw new MarketplaceError('Active category required', 'category_required');
    }
    if (this.now() > Date.parse(input.scheduledAt)) {
      throw new MarketplaceError('Gig must be scheduled in the future', 'invalid_schedule');
    }
    const gig: Gig = {
      id: `gig_${this.id()}`,
      giverId,
      categoryId: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      scheduledAt: new Date(input.scheduledAt).toISOString(),
      budgetAmount: input.budgetAmount,
      currency: 'INR',
      status: 'posted',
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.gigs.save(gig);
    this.audit.record({
      actorId: giverId,
      actorRole: 'giver',
      action: 'gig.posted',
      targetType: 'gig',
      targetId: gig.id,
      metadata: { categoryId: gig.categoryId, budgetAmount: gig.budgetAmount },
    });
    return gig;
  }

  listGigs(filters?: GigFilters): Promise<Gig[]> {
    return this.gigs.list(filters);
  }

  async getGig(gigId: string): Promise<Gig> {
    const gig = await this.gigs.findById(gigId);
    if (!gig) throw new MarketplaceError('Gig not found', 'not_found');
    return gig;
  }

  async apply(gigId: string, workerId: string, input: ApplyInput): Promise<GigApplication> {
    const gig = await this.getGig(gigId);
    if (gig.status !== 'posted' && gig.status !== 'applied') {
      throw new MarketplaceError('Gig is not accepting applications', 'gig_not_open');
    }
    if (gig.giverId === workerId) {
      throw new MarketplaceError('Giver cannot apply to their own gig', 'own_gig');
    }
    if (!(await this.verification.canApply(workerId))) {
      throw new MarketplaceError('Worker must be verified before applying', 'worker_not_verified');
    }
    const existing = await this.applications.findByGigAndWorker(gigId, workerId);
    if (existing && existing.status !== 'withdrawn') {
      return existing;
    }

    const application: GigApplication = {
      id: existing?.id ?? `app_${this.id()}`,
      gigId,
      workerId,
      messageMl: input.messageMl?.trim(),
      proposedPrice: input.proposedPrice,
      status: 'applied',
      createdAt: existing?.createdAt ?? new Date(this.now()).toISOString(),
    };
    await this.applications.save(application);
    if (gig.status === 'posted') {
      await this.gigs.save({ ...gig, status: 'applied' });
    }
    this.audit.record({
      actorId: workerId,
      actorRole: 'worker',
      action: 'gig.application_submitted',
      targetType: 'gig',
      targetId: gigId,
      metadata: { applicationId: application.id },
    });
    return application;
  }

  async listApplications(gigId: string, giverId: string): Promise<GigApplication[]> {
    const gig = await this.requireGiverGig(gigId, giverId);
    return this.applications.listForGig(gig.id);
  }

  async selectApplicant(
    gigId: string,
    applicationId: string,
    giverId: string,
  ): Promise<{ gig: Gig; assignment: Assignment; applications: GigApplication[] }> {
    const gig = await this.requireGiverGig(gigId, giverId);
    if (gig.status !== 'applied') {
      throw new MarketplaceError('Gig must have applicants before selection', 'invalid_state');
    }
    if (await this.assignments.findByGig(gigId)) {
      throw new MarketplaceError('Gig already has a selected worker', 'already_assigned');
    }
    const selected = await this.applications.findById(applicationId);
    if (!selected || selected.gigId !== gigId || selected.status !== 'applied') {
      throw new MarketplaceError('Application not selectable', 'application_not_selectable');
    }
    const applications = await this.applications.listForGig(gigId);
    const assignment: Assignment = {
      id: `asg_${this.id()}`,
      gigId,
      workerId: selected.workerId,
      applicationId: selected.id,
      selectedAt: new Date(this.now()).toISOString(),
    };
    for (const application of applications) {
      await this.applications.save({
        ...application,
        status: application.id === selected.id ? 'selected' : 'rejected',
      });
    }
    await this.assignments.save(assignment);
    const assignedGig: Gig = { ...gig, status: 'assigned' };
    await this.gigs.save(assignedGig);
    this.audit.record({
      actorId: giverId,
      actorRole: 'giver',
      action: 'gig.worker_selected',
      targetType: 'gig',
      targetId: gigId,
      metadata: { applicationId, workerId: selected.workerId },
    });
    return {
      gig: assignedGig,
      assignment,
      applications: await this.applications.listForGig(gigId),
    };
  }

  async transitionGig(gigId: string, actorId: string, next: Extract<GigStatus, 'in_progress' | 'completed' | 'cancelled'>): Promise<Gig> {
    const gig = await this.getGig(gigId);
    const assignment = await this.assignments.findByGig(gigId);
    if (!assignment) throw new MarketplaceError('Gig has no assignment', 'not_assigned');

    if (next === 'in_progress') {
      if (actorId !== assignment.workerId) {
        throw new MarketplaceError('Only selected worker can start the gig', 'forbidden');
      }
      if (gig.status !== 'assigned') {
        throw new MarketplaceError('Only assigned gigs can start', 'invalid_state');
      }
    }
    if (next === 'completed') {
      if (actorId !== gig.giverId) {
        throw new MarketplaceError('Only giver can confirm completion', 'forbidden');
      }
      if (gig.status !== 'in_progress') {
        throw new MarketplaceError('Only in-progress gigs can complete', 'invalid_state');
      }
    }
    if (next === 'cancelled' && actorId !== gig.giverId && actorId !== assignment.workerId) {
      throw new MarketplaceError('Only gig parties can cancel before money is enabled', 'forbidden');
    }

    const updated = { ...gig, status: next };
    await this.gigs.save(updated);
    this.audit.record({
      actorId,
      actorRole: actorId === gig.giverId ? 'giver' : 'worker',
      action: `gig.${next}`,
      targetType: 'gig',
      targetId: gigId,
    });
    return updated;
  }

  private async requireGiverGig(gigId: string, giverId: string): Promise<Gig> {
    const gig = await this.getGig(gigId);
    if (gig.giverId !== giverId) {
      throw new MarketplaceError('Only the giver can manage this gig', 'forbidden');
    }
    return gig;
  }
}

function randomId(): string {
  return randomBytes(10).toString('hex');
}
