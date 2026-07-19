import { Controller, Get } from '@nestjs/common';
import { DisplayNamesService } from './display-names.service';

/**
 * Unauthenticated - apps/frontend needs these overrides to render sport,
 * country, competition, and team names for anonymous browsing too. Only
 * entities with an admin-assigned override are exposed, and only
 * entityType + rawName + displayName (no ids) so an un-overridden name
 * silently falls back to the raw feed name instead of showing a null.
 */
@Controller('public/display-names')
export class PublicDisplayNamesController {
  constructor(private readonly displayNamesService: DisplayNamesService) {}

  @Get()
  async listAssigned() {
    const overrides = await this.displayNamesService.listAssigned();
    return overrides.map((override) => ({
      entityType: override.entityType,
      rawName: override.rawName,
      displayName: override.displayName,
    }));
  }
}
