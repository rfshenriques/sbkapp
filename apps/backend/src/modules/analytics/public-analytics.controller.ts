import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { IngestAnalyticsEventsDto } from './dto/ingest-analytics-events.dto';
import { AnalyticsService } from './analytics.service';

/**
 * Unauthenticated (anonymous visitors get tracked too, before they ever
 * log in) but throttled - it's a public write endpoint, so without a limit
 * it'd be an easy way to flood the analytics_events table. A valid Bearer
 * token is read on a best-effort basis (OptionalPlayerAuthService never
 * throws) so events from a logged-in player get attributed to their
 * userId without requiring the client to self-report it.
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 300_000 } })
@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly optionalPlayerAuth: OptionalPlayerAuthService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ingest(
    @Body() dto: IngestAnalyticsEventsDto,
    @Headers('authorization') authorizationHeader?: string,
  ): Promise<void> {
    const player = await this.optionalPlayerAuth.resolve(authorizationHeader);
    await this.analyticsService.ingest(dto.brandId, dto.sessionId, player?.sub ?? null, dto.events);
  }
}
