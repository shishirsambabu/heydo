import { PushDelivery, PushDevice, UserNotification } from './notification.entities';

export interface NotificationRepository {
  save(notification: UserNotification): Promise<UserNotification>;
  listForUser(userId: string, limit: number): Promise<UserNotification[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(id: string, userId: string, at: string): Promise<UserNotification | null>;
  markAllRead(userId: string, at: string): Promise<number>;
  updatePushStatus(id: string, status: UserNotification['pushStatus']): Promise<void>;
  saveDevice(device: PushDevice): Promise<PushDevice>;
  findDeviceByFingerprint(fingerprint: string): Promise<PushDevice | null>;
  listDevices(userId: string, activeOnly?: boolean): Promise<PushDevice[]>;
  revokeDevice(id: string, userId: string, at: string): Promise<PushDevice | null>;
  saveDelivery(delivery: PushDelivery): Promise<PushDelivery>;
  updateDelivery(delivery: PushDelivery): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<string, UserNotification>();
  private readonly byDedupeKey = new Map<string, string>();
  private readonly devices = new Map<string, PushDevice>();
  private readonly deliveries = new Map<string, PushDelivery>();

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

  async updatePushStatus(id: string, status: UserNotification['pushStatus']): Promise<void> {
    const item = this.items.get(id);
    if (item) this.items.set(id, { ...item, pushStatus: status });
  }

  async saveDevice(device: PushDevice): Promise<PushDevice> {
    this.devices.set(device.id, { ...device });
    return { ...device };
  }

  async findDeviceByFingerprint(fingerprint: string): Promise<PushDevice | null> {
    const device = [...this.devices.values()].find(
      (item) => item.tokenFingerprint === fingerprint,
    );
    return device ? { ...device } : null;
  }

  async listDevices(userId: string, activeOnly = false): Promise<PushDevice[]> {
    return [...this.devices.values()]
      .filter((item) => item.userId === userId && (!activeOnly || item.active))
      .map((item) => ({ ...item }));
  }

  async revokeDevice(id: string, userId: string, at: string): Promise<PushDevice | null> {
    const device = this.devices.get(id);
    if (!device || device.userId !== userId) return null;
    const updated = { ...device, active: false, updatedAt: at };
    this.devices.set(id, updated);
    return { ...updated };
  }

  async saveDelivery(delivery: PushDelivery): Promise<PushDelivery> {
    const existing = [...this.deliveries.values()].find(
      (item) =>
        item.notificationId === delivery.notificationId && item.deviceId === delivery.deviceId,
    );
    if (existing) return { ...existing };
    this.deliveries.set(delivery.id, { ...delivery });
    return { ...delivery };
  }

  async updateDelivery(delivery: PushDelivery): Promise<void> {
    this.deliveries.set(delivery.id, { ...delivery });
  }
}
