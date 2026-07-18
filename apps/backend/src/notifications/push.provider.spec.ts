import { ConfigService } from '@nestjs/config';
import { DisabledPushProvider, FcmPushProvider } from './push.provider';

describe('Push providers', () => {
  it('reports disabled delivery truthfully', async () => {
    await expect(new DisabledPushProvider().send()).resolves.toEqual({ status: 'not_configured' });
  });

  it('does not call FCM unless explicitly configured', async () => {
    const provider = new FcmPushProvider({ get: () => undefined } as unknown as ConfigService);
    await expect(provider.send({ token: 'secret', title: 'Title', body: 'Body', data: {} }))
      .resolves.toEqual({ status: 'not_configured' });
  });
});
