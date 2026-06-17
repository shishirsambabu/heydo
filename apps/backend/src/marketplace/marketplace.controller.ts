import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsISO8601, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketplaceError, MarketplaceService } from './marketplace.service';

class PostGigDto {
  @IsString() categoryId!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsString() @MinLength(2) location!: string;
  @IsISO8601() scheduledAt!: string;
  @IsInt() @Min(100) budgetAmount!: number;
}

class ApplyDto {
  @IsOptional() @IsString() messageMl?: string;
  @IsOptional() @IsInt() @Min(100) proposedPrice?: number;
}

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(protected readonly marketplace: MarketplaceService) {}

  @Get('categories')
  categories() {
    return this.marketplace.listCategories();
  }

  @Post('gigs')
  async postGig(@CurrentUser() principal: AuthPrincipal, @Body() dto: PostGigDto) {
    return this.wrap(() => this.marketplace.postGig(principal.sub, dto));
  }

  @Get('gigs')
  listGigs(@Query('status') status?: string, @Query('categoryId') categoryId?: string) {
    return this.marketplace.listGigs({ status, categoryId });
  }

  @Get('gigs/:gigId')
  async getGig(@Param('gigId') gigId: string) {
    return this.wrap(() => this.marketplace.getGig(gigId));
  }

  @Post('gigs/:gigId/applications')
  async apply(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ApplyDto,
  ) {
    return this.wrap(() => this.marketplace.apply(gigId, principal.sub, dto));
  }

  @Get('gigs/:gigId/applications')
  async applications(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    return this.wrap(() => this.marketplace.listApplications(gigId, principal.sub));
  }

  @Post('gigs/:gigId/applications/:applicationId/select')
  async select(
    @Param('gigId') gigId: string,
    @Param('applicationId') applicationId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(() => this.marketplace.selectApplicant(gigId, applicationId, principal.sub));
  }

  @Post('gigs/:gigId/start')
  async start(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    return this.wrap(() => this.marketplace.transitionGig(gigId, principal.sub, 'in_progress'));
  }

  @Post('gigs/:gigId/complete')
  async complete(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    return this.wrap(() => this.marketplace.transitionGig(gigId, principal.sub, 'completed'));
  }

  @Post('gigs/:gigId/cancel')
  async cancel(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    return this.wrap(() => this.marketplace.transitionGig(gigId, principal.sub, 'cancelled'));
  }

  protected async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MarketplaceError) {
        if (error.code === 'not_found') throw new NotFoundException(error.message);
        if (error.code === 'forbidden') throw new ForbiddenException(error.message);
        if (
          [
            'worker_not_verified',
            'gig_not_visible',
            'gig_not_open',
            'invalid_state',
            'already_assigned',
            'application_not_selectable',
            'own_gig',
          ].includes(error.code)
        ) {
          throw new ConflictException({ code: error.code, message: error.message });
        }
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }
}
