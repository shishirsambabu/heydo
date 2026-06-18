import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/audit/audit.service';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../common/database/database.module';
import {
  InMemoryMoneyRepository,
  MONEY_REPOSITORY,
  MoneyRepository,
} from './money.repository';
import { PostgresMoneyRepository } from './postgres-money.repository';
import { MoneyService } from './money.service';

@Module({
  imports: [CommonModule, DatabaseModule],
  providers: [
    {
      provide: MONEY_REPOSITORY,
      inject: [ConfigService, PostgresMoneyRepository],
      useFactory: (config: ConfigService, postgres: PostgresMoneyRepository): MoneyRepository =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryMoneyRepository(),
    },
    PostgresMoneyRepository,
    {
      provide: MoneyService,
      inject: [MONEY_REPOSITORY, AuditService],
      useFactory: (repo: MoneyRepository, audit: AuditService) => new MoneyService(repo, audit),
    },
  ],
  exports: [MoneyService],
})
export class MoneyModule {}
