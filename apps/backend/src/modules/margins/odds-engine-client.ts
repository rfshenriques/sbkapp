import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';

/**
 * Server-side client for apps/odds-engine's raw feed - used only by the
 * margin pricing pipeline (see PublicMatchesController). apps/frontend
 * never talks to odds-engine directly for matches/markets any more, so
 * every player-facing price actually passes through margin application;
 * the live in-play score/stats endpoint (no odds on it) is the one
 * exception frontend still calls directly.
 */
@Injectable()
export class OddsEngineClient {
  private readonly baseUrl = process.env.ODDS_ENGINE_URL ?? 'http://localhost:4001';

  async fetchMatches(): Promise<Match[]> {
    const response = await this.get('/events');
    if (!response.ok) {
      throw new InternalServerErrorException(`odds-engine /events failed: ${response.status}`);
    }
    return (await response.json()) as Match[];
  }

  async fetchMatchById(matchId: string): Promise<Match> {
    const response = await this.get(`/events/${encodeURIComponent(matchId)}`);
    if (response.status === 404) {
      throw new NotFoundException('Match not found');
    }
    if (!response.ok) {
      throw new InternalServerErrorException(`odds-engine /events/:id failed: ${response.status}`);
    }
    return (await response.json()) as Match;
  }

  /** Network-level failures (odds-engine unreachable) surface as a plain TypeError from fetch - normalize to the same 500 a bad HTTP status would give. */
  private async get(path: string): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`);
    } catch {
      throw new InternalServerErrorException('odds-engine is unreachable');
    }
  }
}
