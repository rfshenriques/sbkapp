import { Injectable } from '@nestjs/common';
import { ANONYMOUS_VIEWER, type AudienceViewer } from '../audience/audience';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { PlayerSegmentService } from '../player-segments/player-segment.service';

/**
 * Turns an Authorization header into the AudienceViewer manual markets and
 * boosts filter against - shared by every public, no-login-required
 * endpoint that still needs to know "who's asking" (matches, specials,
 * boosts). A missing/invalid token resolves to the anonymous viewer, same
 * as browsing logged out.
 */
@Injectable()
export class ViewerResolverService {
  constructor(
    private readonly optionalPlayerAuthService: OptionalPlayerAuthService,
    private readonly playerSegmentService: PlayerSegmentService,
  ) {}

  async resolve(authorizationHeader: string | undefined): Promise<AudienceViewer> {
    const payload = await this.optionalPlayerAuthService.resolve(authorizationHeader);
    if (!payload) {
      return ANONYMOUS_VIEWER;
    }

    const segmentIds = await this.playerSegmentService.resolveSegmentIdsForUser(payload.sub);
    return { isLoggedIn: true, segmentIds };
  }
}
