import { DiditVkycProvider } from './didit-vkyc-provider';

type FetchCall = {
  input: string;
  init: {
    method?: string;
    headers: Record<string, string>;
    body?: string;
  };
};

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('DiditVkycProvider', () => {
  it('creates a Didit session with server-side auth and language fallback', async () => {
    const calls: FetchCall[] = [];
    const provider = new DiditVkycProvider(
      {
        apiKey: 'didit_secret',
        workflowId: '11111111-2222-3333-4444-555555555555',
        callbackUrl: 'https://api.heydo.test/verification/callback',
      },
      async (input, init) => {
        calls.push({ input, init });
        return okJson({
          session_id: 'didit_sess_1',
          url: 'https://verify.didit.me/session/token',
          session_token: 'token',
        });
      },
    );

    const session = await provider.start({ userId: 'usr_1', locale: 'ml', subjectRole: 'worker' });

    expect(session).toEqual({
      sessionId: 'didit_sess_1',
      launchToken: 'https://verify.didit.me/session/token',
      vendor: 'didit',
    });
    expect(calls[0].input).toBe('https://verification.didit.me/v3/session/');
    expect(calls[0].init.headers['x-api-key']).toBe('didit_secret');
    expect(JSON.parse(calls[0].init.body ?? '{}')).toMatchObject({
      workflow_id: '11111111-2222-3333-4444-555555555555',
      vendor_data: 'usr_1',
      callback_method: 'both',
      language: 'en',
    });
  });

  it('uses the separate giver workflow when starting giver verification', async () => {
    const calls: FetchCall[] = [];
    const provider = new DiditVkycProvider(
      {
        apiKey: 'didit_secret',
        workflowId: 'worker_wf',
        giverWorkflowId: 'giver_wf',
      },
      async (input, init) => {
        calls.push({ input, init });
        return okJson({ session_id: 'giver_sess', url: 'https://verify.didit.me/session/giver' });
      },
    );

    await provider.start({ userId: 'giver_1', locale: 'en', subjectRole: 'giver' });

    expect(JSON.parse(calls[0].init.body ?? '{}')).toMatchObject({
      workflow_id: 'giver_wf',
      vendor_data: 'giver_1',
    });
  });

  it('maps approved Didit decision signals into Heydo VKYC result signals', async () => {
    const provider = new DiditVkycProvider(
      { apiKey: 'didit_secret', workflowId: 'wf' },
      async () =>
        okJson({
          session_id: 'didit_sess_1',
          session_url: 'https://verify.didit.me/session/token',
          status: 'APPROVED',
          id_verifications: [{ status: 'Approved' }],
          liveness_checks: [{ status: 'Approved', score: 0.98 }],
          face_matches: [{ status: 'Approved', score: 0.94 }],
        }),
    );

    await expect(provider.getResult('didit_sess_1')).resolves.toEqual({
      sessionId: 'didit_sess_1',
      vendor: 'didit',
      livenessPassed: true,
      aadhaarMatch: true,
      faceMatchScore: 0.94,
      aadhaarToken: 'didit_session:didit_sess_1',
      mediaRef: 'https://verify.didit.me/session/token',
    });
  });

  it('normalizes Didit percentage face-match scores into Heydo 0..1 scores', async () => {
    const provider = new DiditVkycProvider(
      { apiKey: 'didit_secret', workflowId: 'wf' },
      async () =>
        okJson({
          session_id: 'didit_sess_1',
          status: 'APPROVED',
          id_verifications: [{ status: 'Approved' }],
          liveness_checks: [{ status: 'Approved' }],
          face_matches: [{ status: 'Approved', score: 97.35 }],
        }),
    );

    await expect(provider.getResult('didit_sess_1')).resolves.toMatchObject({
      faceMatchScore: 0.9735,
    });
  });

  it('does not convert unfinished Didit sessions into final Heydo decisions', async () => {
    const provider = new DiditVkycProvider(
      { apiKey: 'didit_secret', workflowId: 'wf' },
      async () => okJson({ session_id: 'didit_sess_1', status: 'In Progress' }),
    );

    await expect(provider.getResult('didit_sess_1')).rejects.toThrow('not final yet');
  });
});
