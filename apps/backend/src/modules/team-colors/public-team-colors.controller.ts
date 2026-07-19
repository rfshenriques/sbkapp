import { Controller, Get } from '@nestjs/common';
import { TeamColorsService } from './team-colors.service';

/**
 * Unauthenticated - apps/frontend needs each team's color to render the
 * small colored edge shape on match cards for anonymous browsing too. Only
 * teams with an admin-assigned color are exposed, and only name + colorHex
 * (no ids, no unassigned rows) so an unassigned team silently falls back to
 * the frontend's default styling instead of showing a null color.
 */
@Controller('public/team-colors')
export class PublicTeamColorsController {
  constructor(private readonly teamColorsService: TeamColorsService) {}

  @Get()
  async listAssigned() {
    const teamColors = await this.teamColorsService.listAssigned();
    return teamColors.map((teamColor) => ({ name: teamColor.name, colorHex: teamColor.colorHex }));
  }
}
