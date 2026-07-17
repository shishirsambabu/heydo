import { Inject, Injectable } from '@nestjs/common';
import { NotificationType, UserNotification } from './notification.entities';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from './notification.repository';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  titleMl: string;
  titleEn: string;
  bodyMl: string;
  bodyEn: string;
  gigId?: string;
  dedupeKey: string;
}

export class NotificationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
  ) {}

  private readonly now = () => Date.now();
  private readonly id = () => Math.random().toString(36).slice(2, 14);

  create(input: CreateNotificationInput): Promise<UserNotification> {
    return this.repository.save({
      id: `ntf_${this.id()}`,
      ...input,
      pushStatus: 'not_configured',
      createdAt: new Date(this.now()).toISOString(),
    });
  }

  list(userId: string, limit = 50): Promise<UserNotification[]> {
    return this.repository.listForUser(userId, Math.max(1, Math.min(limit, 100)));
  }

  async summary(userId: string) {
    return { unreadCount: await this.repository.unreadCount(userId) };
  }

  async markRead(id: string, userId: string): Promise<UserNotification> {
    const notification = await this.repository.markRead(
      id,
      userId,
      new Date(this.now()).toISOString(),
    );
    if (!notification) throw new NotificationError('Notification not found', 'not_found');
    return notification;
  }

  async markAllRead(userId: string) {
    return {
      updatedCount: await this.repository.markAllRead(
        userId,
        new Date(this.now()).toISOString(),
      ),
    };
  }
}
