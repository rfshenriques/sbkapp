import { Controller, Get, Param } from '@nestjs/common';
import { MatchOfTheDayService } from './match-of-the-day.service';

/**
 * Unauthenticated, player-facing - backs the homepage's "Match of the day"
 * row. Only currently-active picks (see MatchOfTheDayService.
 * listActiveForViewer), in staff-configured display order.
 */
@Controller('public/match-of-the-day')
export class PublicMatchOfTheDayController {
  constructor(private readonly matchOfTheDayService: MatchOfTheDayService) {}

  @Get(':brandId')
  list(@Param('brandId') brandId: string) {
    return this.matchOfTheDayService.listActiveForViewer(brandId);
  }
}
