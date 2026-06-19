import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpService } from './otp/otp.service';
import { OTP_SENDER, OtpSender } from './otp/otp-sender';
import { IdentityService } from '../identity/identity.service';
import { AuthPrincipal } from './auth.types';
import { User } from '../identity/entities';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly identity: IdentityService,
    private readonly jwt: JwtService,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async requestOtp(phone: string): Promise<{ sent: boolean; retryAfterMs?: number; devCode?: string }> {
    const res = await this.otp.request(phone);
    // DEV ONLY: with the mock sender (no real SMS) surface the code so the flow
    // is testable. Never enabled in production. See .claude/rules/ (no OTP in logs).
    const devCode =
      process.env.NODE_ENV !== 'production' && 'peek' in this.sender
        ? (this.sender as unknown as { peek(p: string): string | undefined }).peek(phone)
        : undefined;
    return { ...res, devCode };
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; user: User }> {
    const result = this.otp.verify(phone, code);
    if (!result.ok) {
      throw new UnauthorizedException(`OTP ${result.reason}`);
    }
    const user = await this.identity.findOrCreateUser(phone);
    const principal: AuthPrincipal = { sub: user.id, kind: 'user', roles: user.roles };
    const token = await this.jwt.signAsync(principal);
    return { token, user };
  }

  /**
   * DEV ONLY admin login. Real admin auth is SSO + mandatory MFA (Phase 7).
   * Issues an admin JWT with the requested ops roles if the shared dev secret
   * matches. Disabled in production.
   */
  async adminDevLogin(
    secret: string,
    adminId: string,
    roles: AuthPrincipal['roles'],
  ): Promise<{ token: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Dev login disabled in production');
    }
    const expected = process.env.ADMIN_DEV_SECRET ?? 'dev-admin-secret';
    if (secret !== expected) throw new UnauthorizedException('Bad admin secret');
    const principal: AuthPrincipal = {
      sub: adminId,
      kind: 'admin',
      roles,
      adminMfaVerifiedAt: Date.now(),
      adminDeviceId: `dev:${adminId}`,
    };
    const token = await this.jwt.signAsync(principal);
    return { token };
  }
}
