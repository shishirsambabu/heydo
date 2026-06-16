import { randomBytes } from 'crypto';
import {
  VkycProvider,
  VkycResult,
  VkycSession,
  VkycStartRequest,
} from './vkyc-provider';

/**
 * Mock VKYC provider for Phase 1 dev/test. Simulates the vendor: a session is
 * started, then a result is produced. By default it returns a PASS; tests can
 * queue specific outcomes (e.g. liveness failure) to exercise rejection paths.
 *
 * Swap for SignzyProvider / HyperVergeProvider before go-live.
 */
export class MockVkycProvider implements VkycProvider {
  readonly name = 'mock';
  private readonly sessions = new Map<string, string>(); // sessionId -> userId
  private readonly queuedOutcomes = new Map<string, Partial<VkycResult>>();

  async start(req: VkycStartRequest): Promise<VkycSession> {
    const sessionId = `mock_sess_${randomBytes(8).toString('hex')}`;
    this.sessions.set(sessionId, req.userId);
    return {
      sessionId,
      launchToken: `mock_launch_${randomBytes(6).toString('hex')}`,
      vendor: this.name,
    };
  }

  /** Test helper: force a specific outcome for the next getResult of a session. */
  queueOutcome(sessionId: string, outcome: Partial<VkycResult>): void {
    this.queuedOutcomes.set(sessionId, outcome);
  }

  async getResult(sessionId: string): Promise<VkycResult> {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Unknown VKYC session: ${sessionId}`);
    }
    const override = this.queuedOutcomes.get(sessionId) ?? {};
    return {
      sessionId,
      vendor: this.name,
      livenessPassed: override.livenessPassed ?? true,
      aadhaarMatch: override.aadhaarMatch ?? true,
      faceMatchScore: override.faceMatchScore ?? 0.97,
      aadhaarToken: override.aadhaarToken ?? `mock_aadhaar_token_${randomBytes(8).toString('hex')}`,
      mediaRef: override.mediaRef ?? `mock_media_${randomBytes(8).toString('hex')}`,
    };
  }
}
