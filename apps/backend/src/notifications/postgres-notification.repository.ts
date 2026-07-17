import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import { UserNotification } from './notification.entities';
import { NotificationRepository } from './notification.repository';

interface NotificationRow {
  id: string;
  userId: string;
  type: UserNotification['type'];
  titleMl: string;
  titleEn: string;
  bodyMl: string;
  bodyEn: string;
  gigId: string | null;
  dedupeKey: string;
  pushStatus: UserNotification['pushStatus'];
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly pg: PgService) {}

  async save(notification: UserNotification): Promise<UserNotification> {
    const [row] = await this.pg.query<NotificationRow>(
      `INSERT INTO "Notification"
        (id, "userId", type, "titleMl", "titleEn", "bodyMl", "bodyEn", "gigId",
         "dedupeKey", "pushStatus", "readAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT ("dedupeKey") DO UPDATE SET "dedupeKey" = EXCLUDED."dedupeKey"
       RETURNING id, "userId", type, "titleMl", "titleEn", "bodyMl", "bodyEn",
         "gigId", "dedupeKey", "pushStatus", "readAt", "createdAt"`,
      [
        notification.id,
        notification.userId,
        notification.type,
        notification.titleMl,
        notification.titleEn,
        notification.bodyMl,
        notification.bodyEn,
        notification.gigId ?? null,
        notification.dedupeKey,
        notification.pushStatus,
        notification.readAt ?? null,
        notification.createdAt,
      ],
    );
    return toNotification(row);
  }

  async listForUser(userId: string, limit: number): Promise<UserNotification[]> {
    const rows = await this.pg.query<NotificationRow>(
      `SELECT id, "userId", type, "titleMl", "titleEn", "bodyMl", "bodyEn",
         "gigId", "dedupeKey", "pushStatus", "readAt", "createdAt"
       FROM "Notification" WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toNotification);
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.pg.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Notification"
       WHERE "userId" = $1 AND "readAt" IS NULL`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  async markRead(id: string, userId: string, at: string): Promise<UserNotification | null> {
    const [row] = await this.pg.query<NotificationRow>(
      `UPDATE "Notification" SET "readAt" = COALESCE("readAt", $3)
       WHERE id = $1 AND "userId" = $2
       RETURNING id, "userId", type, "titleMl", "titleEn", "bodyMl", "bodyEn",
         "gigId", "dedupeKey", "pushStatus", "readAt", "createdAt"`,
      [id, userId, at],
    );
    return row ? toNotification(row) : null;
  }

  async markAllRead(userId: string, at: string): Promise<number> {
    const rows = await this.pg.query<{ id: string }>(
      `UPDATE "Notification" SET "readAt" = $2
       WHERE "userId" = $1 AND "readAt" IS NULL RETURNING id`,
      [userId, at],
    );
    return rows.length;
  }
}

function toNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    titleMl: row.titleMl,
    titleEn: row.titleEn,
    bodyMl: row.bodyMl,
    bodyEn: row.bodyEn,
    gigId: row.gigId ?? undefined,
    dedupeKey: row.dedupeKey,
    pushStatus: row.pushStatus,
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
