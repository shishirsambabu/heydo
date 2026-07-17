import { PgService } from '../common/database/pg.service';
import { PostgresCategoryRepository } from './postgres-marketplace.repository';

describe('PostgresCategoryRepository', () => {
  it('seeds missing defaults without reactivating operator-disabled categories', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new PostgresCategoryRepository({ query } as unknown as PgService);

    await repository.listActive();

    const seedQueries = query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('INSERT INTO "Category"'));
    expect(seedQueries.length).toBeGreaterThan(0);
    expect(seedQueries.every((sql) => sql.includes('ON CONFLICT (id) DO NOTHING'))).toBe(true);
    expect(seedQueries.every((sql) => !sql.includes('DO UPDATE'))).toBe(true);
  });
});
