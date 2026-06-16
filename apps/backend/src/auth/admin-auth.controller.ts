import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { AdminRole } from './auth.types';

class AdminDevLoginDto {
  @IsString() secret!: string;
  @IsString() adminId!: string;
  @IsArray() roles!: AdminRole[];
}

/**
 * DEV-ONLY admin authentication. Lets us obtain a Verification-Officer token to
 * exercise the admin queue. Replaced by SSO + MFA in Phase 7 hardening.
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('dev-login')
  devLogin(@Body() dto: AdminDevLoginDto) {
    return this.auth.adminDevLogin(dto.secret, dto.adminId, dto.roles);
  }
}
