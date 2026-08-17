import { vi } from 'vitest';
import { mockMatches } from '../mocks/matches';
import type { LiveMatchState, Match } from '@sportsbook/shared';
import { useBrandStore } from '../features/brand/brandStore';

const ODDS_ENGINE_BASE_URL = '/api';
const BACKEND_BASE_URL = '/backend';

/** Matches useMatches/useMatch's Boolean(brandId) gate - any value works, tests just need it set. */
export const TEST_BRAND_ID = 'test-brand';

/**
 * Stubs global fetch to behave like:
 * - the backend's margin-adjusted GET public/matches/:brandId and
 *   GET public/matches/:brandId/:matchId (what apps/frontend actually
 *   fetches matches from - see backendApi.ts's getMatches/getMatchById)
 * - odds-engine's GET /events/:id/live (the one endpoint still fetched
 *   directly, since live in-play state carries no odds to margin-adjust)
 *
 * Also sets useBrandStore's brandId, since useMatches/useMatch are gated
 * on it being present - without this their queries would just stay
 * disabled and nothing would ever fetch. A test that renders the full
 * AppShell also runs useBrandTheme, which re-resolves the brand itself
 * (GET public/brands/by-domain/:hostname) and overwrites brandId with
 * whatever that returns - stubbing it too, with a matching id, keeps that
 * from clobbering the value back to undefined after this initial set.
 */
export function stubOddsEngineFetch(
  matches: Match[] = mockMatches,
  liveStates: Record<string, LiveMatchState> = {},
) {
  useBrandStore.setState({ brandId: TEST_BRAND_ID });

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith(`${BACKEND_BASE_URL}/public/brands/by-domain/`)) {
      return new Response(
        JSON.stringify({
          id: TEST_BRAND_ID,
          name: 'Test Brand',
          logoLightUrl: null,
          logoDarkUrl: null,
          shareLogoLightUrl: null,
          shareLogoDarkUrl: null,
          themeMode: 'DARK',
          backgroundColor: null,
          buttonColor: null,
          highlightColor: null,
          filterColor: null,
          textColor: null,
        }),
        { status: 200 },
      );
    }

    if (url === `${BACKEND_BASE_URL}/public/matches/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify(matches), { status: 200 });
    }

    if (url === `${BACKEND_BASE_URL}/public/promo-cards/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (url === `${BACKEND_BASE_URL}/public/homepage-carousel-config/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify({ enabled: false, autoScrollSeconds: 6 }), { status: 200 });
    }

    const liveMatch = new RegExp(`^${ODDS_ENGINE_BASE_URL}/events/([^/]+)/live$`).exec(url);
    if (liveMatch) {
      const state = liveStates[liveMatch[1] as string];
      return state
        ? new Response(JSON.stringify(state), { status: 200 })
        : new Response(null, { status: 404 });
    }

    const matchByIdMatch = new RegExp(`^${BACKEND_BASE_URL}/public/matches/${TEST_BRAND_ID}/([^/]+)$`).exec(url);
    if (matchByIdMatch) {
      const found = matches.find((match) => match.id === matchByIdMatch[1]);
      return found
        ? new Response(JSON.stringify(found), { status: 200 })
        : new Response(null, { status: 404 });
    }

    return new Response(null, { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
