import { ConfigService } from '@nestjs/config';
import { AdminVerificationController } from './admin-verification.controller';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('AdminVerificationController readiness', () => {
  it('reports live Didit readiness without exposing secret values', () => {
    const controller = new AdminVerificationController(
      { listPendingReview: jest.fn() } as never,
      config({
        VKYC_PROVIDER: 'didit',
        DIDIT_API_KEY: 'didit_secret_key',
        DIDIT_WORKFLOW_ID: 'worker_workflow_id',
        DIDIT_GIVER_WORKFLOW_ID: 'giver_workflow_id',
        DIDIT_WEBHOOK_SECRET: 'webhook_secret',
        DIDIT_CALLBACK_URL: 'https://api.heydo.in/verification/callback',
        PERSISTENCE: 'postgres',
        DATABASE_URL: 'postgresql://secret@host/heydo',
      }),
    );

    const readiness = controller.readiness();

    expect(readiness.readyForLiveDidit).toBe(true);
    expect(readiness.checks).toMatchObject({
      diditProviderEnabled: true,
      diditApiKeyConfigured: true,
      workerWorkflowConfigured: true,
      giverWorkflowConfigured: true,
      webhookSecretConfigured: true,
      callbackUrlConfigured: true,
      postgresPersistenceEnabled: true,
      databaseUrlConfigured: true,
    });
    expect(JSON.stringify(readiness)).not.toContain('didit_secret_key');
    expect(JSON.stringify(readiness)).not.toContain('worker_workflow_id');
    expect(JSON.stringify(readiness)).not.toContain('giver_workflow_id');
    expect(JSON.stringify(readiness)).not.toContain('webhook_secret');
    expect(JSON.stringify(readiness)).not.toContain('postgresql://secret');
  });

  it('marks mock or incomplete verification config as not live-ready', () => {
    const controller = new AdminVerificationController(
      { listPendingReview: jest.fn() } as never,
      config({
        VKYC_PROVIDER: 'mock',
        DIDIT_WORKFLOW_ID: 'worker_workflow_id',
        PERSISTENCE: 'memory',
      }),
    );

    expect(controller.readiness()).toMatchObject({
      provider: 'mock',
      persistence: 'memory',
      readyForLiveDidit: false,
      checks: {
        diditProviderEnabled: false,
        workerWorkflowConfigured: true,
        giverWorkflowConfigured: false,
        postgresPersistenceEnabled: false,
      },
    });
  });
});
