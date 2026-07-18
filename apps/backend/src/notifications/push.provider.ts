import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushSendResult {
  status: 'sent' | 'failed' | 'invalid_token' | 'not_configured';
  providerMessageId?: string;
  errorCode?: string;
}

export interface PushProvider {
  readonly configured: boolean;
  send(message: PushMessage): Promise<PushSendResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export class DisabledPushProvider implements PushProvider {
  readonly configured = false;
  async send(): Promise<PushSendResult> {
    return { status: 'not_configured' };
  }
}

export class FcmPushProvider implements PushProvider {
  readonly configured: boolean;
  private readonly projectId: string;
  private readonly auth: GoogleAuth;

  constructor(private readonly config: ConfigService) {
    this.projectId = config.get<string>('FIREBASE_PROJECT_ID')?.trim() ?? '';
    this.configured = config.get<string>('PUSH_PROVIDER') === 'fcm' && this.projectId.length > 0;
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.configured) return { status: 'not_configured' };
    try {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      if (!accessToken.token) return { status: 'failed', errorCode: 'auth_token_missing' };
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: message.token,
              notification: { title: message.title, body: message.body },
              data: message.data,
              android: { priority: 'high' },
            },
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        name?: string;
        error?: { status?: string; details?: Array<{ errorCode?: string }> };
      };
      const errorCode = payload.error?.details?.find((item) => item.errorCode)?.errorCode ?? payload.error?.status;
      if (response.ok && payload.name) {
        return { status: 'sent', providerMessageId: payload.name };
      }
      if (response.status === 404 || errorCode === 'UNREGISTERED') {
        return { status: 'invalid_token', errorCode: 'unregistered' };
      }
      return { status: 'failed', errorCode: normalizeErrorCode(errorCode ?? `http_${response.status}`) };
    } catch (error) {
      const code = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'provider_unavailable';
      return { status: 'failed', errorCode: code };
    }
  }
}

function normalizeErrorCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 80);
}
