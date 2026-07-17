import { InMemoryNotificationRepository } from './notification.repository';
import { NotificationError, NotificationService } from './notification.service';

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
});
