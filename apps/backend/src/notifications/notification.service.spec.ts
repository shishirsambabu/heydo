import { InMemoryNotificationRepository } from './notification.repository';
import { NotificationError, NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';
import { PushProvider } from './push.provider';

describe('NotificationService', () => {
  function setup() {
    return new NotificationService(new InMemoryNotificationRepository());
  }

  it('deduplicates retried marketplace events and isolates users', async () => {
    const service = setup();
    const input = {
      userId: 'giver_1',
      type: 'application_received' as const,
      titleMl: 'പുതിയ അപേക്ഷ',
      titleEn: 'New application',
      bodyMl: 'ഒരു തൊഴിലാളി അപേക്ഷിച്ചു.',
      bodyEn: 'A worker applied.',
      gigId: 'gig_1',
      dedupeKey: 'application:app_1:giver',
    };

    const first = await service.create(input);
    const retried = await service.create(input);

    expect(retried.id).toBe(first.id);
    await expect(service.list('giver_1')).resolves.toHaveLength(1);
    await expect(service.list('worker_1')).resolves.toEqual([]);
  });

  it('tracks unread state without allowing cross-user reads', async () => {
    const service = setup();
    const notification = await service.create({
      userId: 'worker_1',
      type: 'application_selected',
      titleMl: 'നിങ്ങളെ തിരഞ്ഞെടുത്തു',
      titleEn: 'You were selected',
      bodyMl: 'ജോലിക്കായി നിങ്ങളെ തിരഞ്ഞെടുത്തു.',
      bodyEn: 'You were selected for the gig.',
      gigId: 'gig_1',
      dedupeKey: 'selection:gig_1:worker_1',
    });

    await expect(service.summary('worker_1')).resolves.toEqual({ unreadCount: 1 });
    await expect(service.markRead(notification.id, 'other_user')).rejects.toMatchObject<
      Partial<NotificationError>
    >({ code: 'not_found' });
    await service.markRead(notification.id, 'worker_1');
    await expect(service.summary('worker_1')).resolves.toEqual({ unreadCount: 0 });
  });

  it('encrypts and redacts registered device tokens while preserving owner isolation', async () => {
    const repo = new InMemoryNotificationRepository();
    const config = { get: (key: string) => key === 'PUSH_TOKEN_ENCRYPTION_KEY' ? 'test-push-key' : undefined } as ConfigService;
    const service = new NotificationService(repo, undefined, config);
    const token = 'fcm-registration-token-that-must-never-be-returned';

    const registered = await service.registerDevice('worker_1', 'android', token, 'ml');
    expect(JSON.stringify(registered)).not.toContain(token);
    await expect(service.listDevices('worker_1')).resolves.toEqual([registered]);
    await expect(service.listDevices('giver_1')).resolves.toEqual([]);
    await expect(service.revokeDevice(registered.id, 'giver_1')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('records successful push delivery and does not resend a deduplicated event', async () => {
    const repo = new InMemoryNotificationRepository();
    const provider: PushProvider = {
      configured: true,
      send: jest.fn().mockResolvedValue({ status: 'sent', providerMessageId: 'fcm_1' }),
    };
    const config = { get: () => 'test-push-key' } as unknown as ConfigService;
    const service = new NotificationService(repo, provider, config);
    await service.registerDevice('worker_1', 'android', 'fcm-registration-token-for-worker-number-one', 'en');
    const input = {
      userId: 'worker_1', type: 'gig_started' as const,
      titleMl: 'ജോലി തുടങ്ങി', titleEn: 'Gig started', bodyMl: 'ജോലി തുടങ്ങി.', bodyEn: 'The gig started.',
      gigId: 'gig_1', dedupeKey: 'gig:gig_1:started:worker_1',
    };

    const first = await service.create(input);
    await service.create(input);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect((await service.list('worker_1'))[0]).toMatchObject({ id: first.id, pushStatus: 'sent' });
  });

  it('deactivates invalid provider tokens', async () => {
    const repo = new InMemoryNotificationRepository();
    const provider: PushProvider = { configured: true, send: jest.fn().mockResolvedValue({ status: 'invalid_token', errorCode: 'unregistered' }) };
    const service = new NotificationService(repo, provider, { get: () => 'test-push-key' } as unknown as ConfigService);
    const device = await service.registerDevice('worker_1', 'android', 'expired-fcm-registration-token-for-worker-one', 'en');
    await service.create({ userId: 'worker_1', type: 'gig_cancelled', titleMl: 'റദ്ദാക്കി', titleEn: 'Cancelled', bodyMl: 'റദ്ദാക്കി.', bodyEn: 'Cancelled.', dedupeKey: 'cancel:1' });
    expect(await service.listDevices('worker_1')).toEqual([{ ...device, active: false, updatedAt: expect.any(String) }]);
  });
});
