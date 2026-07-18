import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import { PushDelivery, PushDevice, UserNotification } from './notification.entities';
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

  async updatePushStatus(id: string, status: UserNotification['pushStatus']): Promise<void> {
    await this.pg.query(`UPDATE "Notification" SET "pushStatus" = $2 WHERE id = $1`, [id, status]);
  }

  async saveDevice(device: PushDevice): Promise<PushDevice> {
    const [row] = await this.pg.query<PushDeviceRow>(
      `INSERT INTO "PushDevice"
        (id, "userId", platform, "tokenFingerprint", "encryptedToken", locale, active,
         "lastSeenAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT ("tokenFingerprint") DO UPDATE SET
         "userId" = EXCLUDED."userId", platform = EXCLUDED.platform,
         "encryptedToken" = EXCLUDED."encryptedToken", locale = EXCLUDED.locale,
         active = true, "lastSeenAt" = EXCLUDED."lastSeenAt", "updatedAt" = EXCLUDED."updatedAt"
       RETURNING *`,
      [device.id, device.userId, device.platform, device.tokenFingerprint, device.encryptedToken,
        device.locale, device.active, device.lastSeenAt, device.createdAt, device.updatedAt],
    );
    return toDevice(row);
  }

  async findDeviceByFingerprint(fingerprint: string): Promise<PushDevice | null> {
    const [row] = await this.pg.query<PushDeviceRow>(
      `SELECT * FROM "PushDevice" WHERE "tokenFingerprint" = $1`, [fingerprint],
    );
    return row ? toDevice(row) : null;
  }

  async listDevices(userId: string, activeOnly = false): Promise<PushDevice[]> {
    const rows = await this.pg.query<PushDeviceRow>(
      `SELECT * FROM "PushDevice" WHERE "userId" = $1 AND ($2::boolean = false OR active = true)
       ORDER BY "updatedAt" DESC`, [userId, activeOnly],
    );
    return rows.map(toDevice);
  }

  async revokeDevice(id: string, userId: string, at: string): Promise<PushDevice | null> {
    const [row] = await this.pg.query<PushDeviceRow>(
      `UPDATE "PushDevice" SET active = false, "updatedAt" = $3
       WHERE id = $1 AND "userId" = $2 RETURNING *`, [id, userId, at],
    );
    return row ? toDevice(row) : null;
  }

  async saveDelivery(delivery: PushDelivery): Promise<PushDelivery> {
    const [row] = await this.pg.query<PushDeliveryRow>(
      `INSERT INTO "PushDelivery"
        (id, "notificationId", "deviceId", status, attempts, "providerMessageId", "errorCode", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("notificationId", "deviceId") DO UPDATE SET "updatedAt" = "PushDelivery"."updatedAt"
       RETURNING *`,
      [delivery.id, delivery.notificationId, delivery.deviceId, delivery.status, delivery.attempts,
        delivery.providerMessageId ?? null, delivery.errorCode ?? null, delivery.createdAt, delivery.updatedAt],
    );
    return toDelivery(row);
  }

  async updateDelivery(delivery: PushDelivery): Promise<void> {
    await this.pg.query(
      `UPDATE "PushDelivery" SET status=$2, attempts=$3, "providerMessageId"=$4,
       "errorCode"=$5, "updatedAt"=$6 WHERE id=$1`,
      [delivery.id, delivery.status, delivery.attempts, delivery.providerMessageId ?? null,
        delivery.errorCode ?? null, delivery.updatedAt],
    );
  }
}

interface PushDeviceRow extends Omit<PushDevice, 'lastSeenAt' | 'createdAt' | 'updatedAt'> {
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PushDeliveryRow extends Omit<PushDelivery, 'createdAt' | 'updatedAt' | 'providerMessageId' | 'errorCode'> {
  providerMessageId: string | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDevice(row: PushDeviceRow): PushDevice {
  return { ...row, lastSeenAt: row.lastSeenAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function toDelivery(row: PushDeliveryRow): PushDelivery {
  return { ...row, providerMessageId: row.providerMessageId ?? undefined, errorCode: row.errorCode ?? undefined,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
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
