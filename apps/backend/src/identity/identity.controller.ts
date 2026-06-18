import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { SelectRoleDto, UpdateWorkerProfileDto } from '../auth/dto';

@Controller('identity')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  /** Current user + worker profile (if any). */
  @Get('me')
  async me(@CurrentUser() principal: AuthPrincipal) {
    const user = await this.identity.getUser(principal.sub);
    const workerProfile = await this.identity.getWorkerProfile(principal.sub);
    const giverProfile = await this.identity.getGiverProfile(principal.sub);
    return { user, workerProfile, giverProfile };
  }

  /** Pick a role (worker/giver) and create the matching profile shell. */
  @Post('role')
  selectRole(@CurrentUser() principal: AuthPrincipal, @Body() dto: SelectRoleDto) {
    return this.identity.selectRole(principal.sub, dto.role, dto.displayName);
  }

  /** Update worker profile details (skills, categories, bio, area). */
  @Patch('worker-profile')
  updateWorker(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateWorkerProfileDto) {
    return this.identity.updateWorkerProfile(principal.sub, dto);
  }
}
