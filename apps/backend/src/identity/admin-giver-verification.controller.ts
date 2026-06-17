import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GiverVerificationStatus } from './entities';
import { IdentityService } from './identity.service';

class ReviewGiverDto {
  @IsIn(['approve', 'reject', 'require_reverification'])
  decision!: 'approve' | 'reject' | 'require_reverification';

  @IsString()
  @MinLength(3)
  notes!: string;
}

@Controller('admin/givers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('verification_officer', 'fraud_analyst', 'support', 'super_admin')
export class AdminGiverVerificationController {
  constructor(private readonly identity: IdentityService) {}

  @Get('verifications')
  list(@Query('status') status?: GiverVerificationStatus) {
    return this.identity.listGiverVerifications(status);
  }

  @Post(':userId/verification-review')
  async review(
    @Param('userId') userId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ReviewGiverDto,
  ) {
    try {
      return await this.identity.reviewGiverVerification(
        userId,
        principal.sub,
        dto.decision,
        dto.notes,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error instanceof Error ? error.message : 'Review failed');
    }
  }
}
