import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class PgService implements OnModuleDestroy {
  private pool?: Pool;

  constructor(private readonly config: ConfigService) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<T[]> {
    return (await this.getPool().query<T>(text, [...values])).rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private getPool(): Pool {
    if (!this.pool) {
      const connectionString = this.config.get<string>('DATABASE_URL');
      if (!connectionString) {
        throw new Error('DATABASE_URL is required when PERSISTENCE=postgres');
      }
      this.pool = new Pool({
        connectionString,
        ssl: this.sslConfig(),
      });
    }
    return this.pool;
  }

  private sslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
    if (this.config.get<string>('DATABASE_SSL') !== 'true') return undefined;
    const caFile = this.config.get<string>('DATABASE_SSL_CA_FILE');
    return caFile
      ? { rejectUnauthorized: true, ca: readFileSync(caFile, 'utf8') }
      : { rejectUnauthorized: true };
  }
}
