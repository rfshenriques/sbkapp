import { Controller, Get } from '@nestjs/common';
import { TeamColorsService } from './team-colors.service';

/**
 * Unauthenticated - apps/frontend needs each team's color (and, for Match of
 * the day's team badges, its acronym) to render for anonymous browsing too.
 * Only teams with an admin-assigned color and/or acronym are exposed, and
 * only name + colorHex + acronym (no ids, no fully-unassigned rows) so an
 * unassigned team silently falls back to the frontend's default styling
 * instead of showing null values.
 */
@Controller('public/team-colors')
export class PublicTeamColorsController {
  constructor(private readonly teamColorsService: TeamColorsService) {}

  @Get()
  async listAssigned() {
    const teamColors = await this.teamColorsService.listAssigned();
    return teamColors.map((teamColor) => ({
      name: teamColor.name,
      colorHex: teamColor.colorHex,
      acronym: teamColor.acronym,
    }));
  }
}
