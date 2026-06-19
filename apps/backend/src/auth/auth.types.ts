import { UserRole } from '../identity/entities';

/** Roles that can appear in a JWT: end-user roles + admin/ops roles. */
export type AdminRole =
  | 'verification_officer'
  | 'dispute_officer'
  | 'fraud_analyst'
  | 'finance'
  | 'partnerships'
  | 'support'
  | 'super_admin';

export type Role = UserRole | AdminRole;

/** Decoded JWT payload attached to the request as req.user. */
export interface AuthPrincipal {
  sub: string; // user/admin id
  kind: 'user' | 'admin';
  roles: Role[];
  adminSessionId?: string;
  adminMfaVerifiedAt?: number;
  adminDeviceId?: string;
}
