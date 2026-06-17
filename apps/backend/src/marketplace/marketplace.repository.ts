import {
  Assignment,
  Category,
  DEFAULT_CATEGORIES,
  Gig,
  GigApplication,
} from './marketplace.entities';

export interface GigFilters {
  status?: string;
  categoryId?: string;
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
}

export interface AssignmentRepository {
  save(assignment: Assignment): Promise<void>;
  findByGig(gigId: string): Promise<Assignment | null>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
export const GIG_REPOSITORY = Symbol('GIG_REPOSITORY');
export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');
export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');

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
