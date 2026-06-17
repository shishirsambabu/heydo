import {
  VkycProvider,
  VkycResult,
  VkycResultNotFinalError,
  VkycSession,
  VkycStartRequest,
} from './vkyc-provider';

interface DiditProviderConfig {
  apiKey: string;
  workflowId: string;
  baseUrl?: string;
  callbackUrl?: string;
  languageFallback?: string;
}

interface DiditSessionResponse {
  session_id: string;
  session_token?: string;
  url?: string;
  session_url?: string;
  status?: string;
}

interface DiditDecisionResponse {
  session_id: string;
  session_url?: string;
  status?: string;
  vendor_data?: string;
  id_verifications?: DiditFeatureResult[];
  database_validations?: DiditFeatureResult[];
  liveness_checks?: DiditFeatureResult[];
  face_matches?: DiditFeatureResult[];
}

interface DiditFeatureResult {
  status?: string;
  score?: number;
  match_type?: string;
}

type DiditFetch = (
  input: string,
  init: {
    method?: string;
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const DIDIT_SUPPORTED_LANGUAGES = new Set([
  'en',
  'ar',
  'bg',
  'bn',
  'bs',
  'ca',
  'cnr',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'it',
  'ja',
  'ka',
  'kk',
  'ko',
  'ky',
  'lt',
  'lv',
  'mk',
  'mn',
  'ms',
  'nl',
  'no',
  'pl',
  'pt-BR',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'so',
  'sq',
  'sr',
  'sv',
  'th',
  'tr',
  'uk',
  'uz',
  'vi',
  'zh-CN',
  'zh-TW',
  'zh',
]);

/**
 * Didit-backed VKYC provider.
 *
 * Didit owns document capture, liveness, and face match. Heydo receives only
 * decision signals and opaque session references. No Aadhaar number, document
 * image, selfie, or media bytes are pulled into Heydo.
 */
export class DiditVkycProvider implements VkycProvider {
  readonly name = 'didit';
  private readonly baseUrl: string;
  private readonly languageFallback: string;

  constructor(
    private readonly config: DiditProviderConfig,
    private readonly fetcher: DiditFetch = fetch as unknown as DiditFetch,
  ) {
    this.baseUrl = (config.baseUrl ?? 'https://verification.didit.me/v3').replace(/\/$/, '');
    this.languageFallback = config.languageFallback ?? 'en';
    if (!config.apiKey || !config.workflowId) {
      throw new Error('Didit VKYC requires DIDIT_API_KEY and DIDIT_WORKFLOW_ID');
    }
  }

  async start(req: VkycStartRequest): Promise<VkycSession> {
    const res = await this.request<DiditSessionResponse>('/session/', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: this.config.workflowId,
        vendor_data: req.userId,
        callback: this.config.callbackUrl,
        callback_method: this.config.callbackUrl ? 'both' : undefined,
        metadata: { heydoUserId: req.userId },
        language: this.diditLanguage(req.locale),
      }),
    });
    return {
      sessionId: res.session_id,
      launchToken: res.url ?? res.session_url ?? res.session_token ?? res.session_id,
      vendor: this.name,
    };
  }

  async getResult(sessionId: string): Promise<VkycResult> {
    const decision = await this.request<DiditDecisionResponse>(
      `/session/${encodeURIComponent(sessionId)}/decision/`,
      { method: 'GET' },
    );
    const status = normalizeStatus(decision.status);
    if (status !== 'approved' && status !== 'declined') {
      throw new VkycResultNotFinalError(
        `Didit session ${sessionId} is not final yet: ${decision.status ?? 'unknown'}`,
        sessionId,
        decision.status,
      );
    }

    const livenessPassed = allApproved(decision.liveness_checks);
    const idApproved =
      allApproved(decision.id_verifications) || allApproved(decision.database_validations);
    const faceMatchScore = bestScore(decision.face_matches, status === 'approved' ? 1 : 0);
    const faceMatchPassed = allApproved(decision.face_matches);

    return {
      sessionId,
      vendor: this.name,
      livenessPassed,
      aadhaarMatch: status === 'approved' && idApproved,
      faceMatchScore: faceMatchPassed ? faceMatchScore : Math.min(faceMatchScore, 0.84),
      aadhaarToken: `didit_session:${sessionId}`,
      mediaRef: decision.session_url ?? `didit_session:${sessionId}`,
    };
  }

  private diditLanguage(locale: string): string {
    const normalized = locale.trim();
    if (DIDIT_SUPPORTED_LANGUAGES.has(normalized)) return normalized;
    const base = normalized.split('-')[0];
    if (DIDIT_SUPPORTED_LANGUAGES.has(base)) return base;
    return this.languageFallback;
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const res = await this.fetcher(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: init.body,
    });
    if (!res.ok) {
      throw new Error(`Didit API ${init.method} ${path} failed with HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }
}

function normalizeStatus(status?: string): string {
  return (status ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function approved(status?: string): boolean {
  return normalizeStatus(status) === 'approved';
}

function allApproved(results: DiditFeatureResult[] | undefined): boolean {
  return !!results?.length && results.every((r) => approved(r.status));
}

function bestScore(results: DiditFeatureResult[] | undefined, fallback: number): number {
  const scores = (results ?? [])
    .map((r) => r.score)
    .filter((score): score is number => typeof score === 'number');
  return scores.length ? Math.max(...scores) : fallback;
}
