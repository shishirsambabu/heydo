/**
 * VkycProvider — swappable abstraction over the licensed VKYC vendor
 * (Signzy / HyperVerge / IDfy). Phase 1 uses MockVkycProvider so the full
 * flow runs end-to-end without a signed vendor contract.
 *
 * Heydo NEVER handles raw Aadhaar in-house: the vendor performs liveness +
 * Aadhaar match + face match and returns a RESULT. We persist a token + media
 * reference in the PII vault, not the Aadhaar number.
 *
 * See .claude/rules/pii_and_privacy.md, .claude/geniuses/trust/identity_verification_genius.md
 */

export interface VkycStartRequest {
  userId: string;
  /** Preferred guidance language for the live call (Malayalam-first). */
  locale: string;
}

export interface VkycSession {
  /** Vendor-side session id the app opens to run the live video KYC. */
  sessionId: string;
  /** URL/token the Flutter app uses to launch the vendor SDK/flow. */
  launchToken: string;
  vendor: string;
}

export interface VkycResult {
  sessionId: string;
  vendor: string;
  livenessPassed: boolean;
  aadhaarMatch: boolean;
  faceMatchScore: number; // 0..1
  /** Opaque vendor token standing in for the verified Aadhaar — NOT the number. */
  aadhaarToken: string;
  /** Vendor reference to the recorded media (stored in the PII vault). */
  mediaRef: string;
}

export interface VkycProvider {
  start(req: VkycStartRequest): Promise<VkycSession>;
  /** Fetch the result for a completed session (or via webhook in prod). */
  getResult(sessionId: string): Promise<VkycResult>;
  readonly name: string;
}

export const VKYC_PROVIDER = Symbol('VKYC_PROVIDER');
