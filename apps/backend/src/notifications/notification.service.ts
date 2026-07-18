import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, PublicPushDevice, PushDevice, PushPlatform, UserNotification } from './notification.entities';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from './notification.repository';
import { PUSH_PROVIDER, PushProvider } from './push.provider';
import { PushTokenCipher } from './push-token-cipher';

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
    @Optional() @Inject(PUSH_PROVIDER) private readonly pushProvider?: PushProvider,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private readonly now = () => Date.now();
  private readonly id = () => Math.random().toString(36).slice(2, 14);

  async create(input: CreateNotificationInput): Promise<UserNotification> {
    const saved = await this.repository.save({
      id: `ntf_${this.id()}`,
      ...input,
      pushStatus: 'not_configured',
      createdAt: new Date(this.now()).toISOString(),
    });
    await this.deliver(saved);
    return saved;
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

  async registerDevice(userId: string, platform: PushPlatform, token: string, locale: 'ml' | 'en'): Promise<PublicPushDevice> {
    const normalizedToken = token.trim();
    if (normalizedToken.length < 20 || normalizedToken.length > 4096) {
      throw new NotificationError('Invalid push registration token', 'invalid_token');
    }
    const cipher = this.tokenCipher();
    const fingerprint = cipher.fingerprint(normalizedToken);
    const existing = await this.repository.findDeviceByFingerprint(fingerprint);
    const at = new Date(this.now()).toISOString();
    const device = await this.repository.saveDevice({
      id: existing?.id ?? `dev_${this.id()}`,
      userId,
      platform,
      tokenFingerprint: fingerprint,
      encryptedToken: cipher.encrypt(normalizedToken),
      locale,
      active: true,
      lastSeenAt: at,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    });
    return publicDevice(device);
  }

  async listDevices(userId: string): Promise<PublicPushDevice[]> {
    return (await this.repository.listDevices(userId)).map(publicDevice);
  }

  async revokeDevice(id: string, userId: string): Promise<PublicPushDevice> {
    const device = await this.repository.revokeDevice(id, userId, new Date(this.now()).toISOString());
    if (!device) throw new NotificationError('Push device not found', 'not_found');
    return publicDevice(device);
  }

  private async deliver(notification: UserNotification): Promise<void> {
    const provider = this.pushProvider;
    const devices = await this.repository.listDevices(notification.userId, true);
    if (!provider?.configured || devices.length === 0) {
      await this.repository.updatePushStatus(notification.id, 'not_configured');
      return;
    }
    await this.repository.updatePushStatus(notification.id, 'pending');
    let sent = 0;
    for (const device of devices) {
      const at = new Date(this.now()).toISOString();
      const delivery = await this.repository.saveDelivery({
        id: `pdl_${this.id()}`,
        notificationId: notification.id,
        deviceId: device.id,
        status: 'pending',
        attempts: 0,
        createdAt: at,
        updatedAt: at,
      });
      if (delivery.status === 'sent') {
        sent += 1;
        continue;
      }
      const result = await provider.send({
        token: this.tokenCipher().decrypt(device.encryptedToken),
        title: device.locale === 'ml' ? notification.titleMl : notification.titleEn,
        body: device.locale === 'ml' ? notification.bodyMl : notification.bodyEn,
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...(notification.gigId ? { gigId: notification.gigId } : {}),
        },
      });
      if (result.status === 'sent') sent += 1;
      if (result.status === 'invalid_token') {
        await this.repository.revokeDevice(device.id, device.userId, at);
      }
      await this.repository.updateDelivery({
        ...delivery,
        status: result.status,
        attempts: delivery.attempts + 1,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode,
        updatedAt: at,
      });
    }
    await this.repository.updatePushStatus(notification.id, sent > 0 ? 'sent' : 'failed');
  }

  private tokenCipher(): PushTokenCipher {
    return new PushTokenCipher(
      this.config?.get<string>('PUSH_TOKEN_ENCRYPTION_KEY') ??
        this.config?.get<string>('PII_ENCRYPTION_KEY') ??
        'dev-only-push-key',
    );
  }
}

function publicDevice(device: PushDevice): PublicPushDevice {
  const { id, platform, locale, active, lastSeenAt, createdAt, updatedAt } = device;
  return { id, platform, locale, active, lastSeenAt, createdAt, updatedAt };
}
