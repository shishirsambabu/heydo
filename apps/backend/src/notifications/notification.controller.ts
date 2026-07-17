import { Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationError, NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal, @Query('limit') limit?: string) {
    return this.notifications.list(principal.sub, limit ? Number(limit) : 50);
  }

  @Get('summary')
  summary(@CurrentUser() principal: AuthPrincipal) {
    return this.notifications.summary(principal.sub);
  }

  @Post(':notificationId/read')
  markRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(() => this.notifications.markRead(notificationId, principal.sub));
  }

  @Post('read-all')
  markAllRead(@CurrentUser() principal: AuthPrincipal) {
    return this.notifications.markAllRead(principal.sub);
  }

  private async wrap<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof NotificationError && error.code === 'not_found') {
        throw new NotFoundException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }
}
