import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService, type HealthStatus, type ReadinessStatus } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Report API process health' })
  @ApiOkResponse({ description: 'The API process is healthy.' })
  getHealth(): HealthStatus {
    return this.healthService.getStatus();
  }

  @Get('ready')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Report API, PostgreSQL, Redis, queue and worker readiness' })
  @ApiOkResponse({ description: 'The API is ready to receive traffic.' })
  @ApiServiceUnavailableResponse({
    description: 'A required production dependency is unavailable.',
  })
  getReadiness(): Promise<ReadinessStatus> {
    return this.healthService.getReadiness();
  }
}
