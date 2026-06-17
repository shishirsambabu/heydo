import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string; phase: string } {
    return { status: 'ok', service: 'heydo-backend', phase: 'phase-2-marketplace' };
  }
}
