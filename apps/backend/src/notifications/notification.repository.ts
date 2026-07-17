import { UserNotification } from './notification.entities';

export interface NotificationRepository {
  save(notification: UserNotification): Promise<UserNotification>;
  listForUser(userId: string, limit: number): Promise<UserNotification[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(id: string, userId: string, at: string): Promise<UserNotification | null>;
  markAllRead(userId: string, at: string): Promise<number>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<string, UserNotification>();
  private readonly byDedupeKey = new Map<string, string>();

  async save(notification: UserNotification): Promise<UserNotification> {
    const existingId = this.byDedupeKey.get(notification.dedupeKey);
    if (existingId) return { ...this.items.get(existingId)! };
    this.items.set(notification.id, { ...notification });
    this.byDedupeKey.set(notification.dedupeKey, notification.id);
    return { ...notification };
  }

  async listForUser(userId: string, limit: number): Promise<UserNotification[]> {
    return [...this.items.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }

  async unreadCount(userId: string): Promise<number> {
    return [...this.items.values()].filter((item) => item.userId === userId && !item.readAt).length;
  }

  async markRead(id: string, userId: string, at: string): Promise<UserNotification | null> {
    const item = this.items.get(id);
    if (!item || item.userId !== userId) return null;
    const updated = { ...item, readAt: item.readAt ?? at };
    this.items.set(id, updated);
    return { ...updated };
  }

  async markAllRead(userId: string, at: string): Promise<number> {
    let count = 0;
    for (const [id, item] of this.items) {
      if (item.userId !== userId || item.readAt) continue;
      this.items.set(id, { ...item, readAt: at });
      count += 1;
    }
    return count;
  }
}
