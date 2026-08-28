/**
 * One-off connectivity/auth check for TheRundown's v2 API - not part of the
 * app, just something to run by hand once (see THERUNDOWN_API_KEY in
 * .env.example). Prints what it got back instead of asserting anything, so
 * a genuinely empty result (off-season, no games that day) doesn't read as
 * a failure the way a thrown error does.
 *
 * Run from apps/odds-engine:
 *   pnpm exec tsx scripts/verify-therundown.ts
 */
import { config } from 'dotenv';
import { createTheRundownClient } from '../src/providers/therundown/client';
import { normalizeTheRundownEvent } from '../src/providers/therundown/normalize';

config();

const rawApiKey = process.env.THERUNDOWN_API_KEY;
if (!rawApiKey) {
  console.error('THERUNDOWN_API_KEY not set in apps/odds-engine/.env - nothing to test.');
  process.exit(1);
}
// TS can't narrow a closed-over outer variable inside the main() closure
// below just from the guard above - bind it to a properly-typed const instead.
const apiKey: string = rawApiKey;

// A few sport IDs likely to have something in-season regardless of when
// this runs - see the v2 sports list: 11=EPL, 4=NBA, 3=MLB, 6=NHL.
const SPORTS_TO_TRY: Array<{ id: number; name: string }> = [
  { id: 11, name: 'EPL' },
  { id: 4, name: 'NBA' },
  { id: 3, name: 'MLB' },
  { id: 6, name: 'NHL' },
];

function todayAndTomorrow(): string[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [today, tomorrow].map((d) => d.toISOString().slice(0, 10));
}

async function main() {
  const client = createTheRundownClient({ apiKey });

  console.log('--- GET /api/v2/sports (no auth required, confirms base connectivity) ---');
  const sports = await client.getSports();
  console.log(`Got ${sports.length} sports. First few:`, sports.slice(0, 5));

  console.log('\n--- GET /api/v2/sports/{id}/events/{date} (auth required, confirms the key works) ---');
  const dates = todayAndTomorrow();
  let foundAny = false;

  for (const sport of SPORTS_TO_TRY) {
    for (const date of dates) {
      const events = await client.getEventsBySportAndDate({ sportId: sport.id, date });
      console.log(`${sport.name} (${sport.id}) on ${date}: ${events.length} event(s)`);
      if (events.length > 0 && !foundAny) {
        foundAny = true;
        const [first] = events;
        console.log('Sample event:', JSON.stringify(first, null, 2).slice(0, 1500));

        console.log('\n--- Through our own normalize.ts (proves the full pipeline, not just raw connectivity) ---');
        const normalized = first ? normalizeTheRundownEvent(first) : undefined;
        console.log(normalized ?? '(sport_id not in RELEVANT_SPORT_IDS, or no home/away team - see normalize.ts)');
      }
    }
  }

  if (!foundAny) {
    console.log(
      '\nNo events found for any tried sport/date - the auth call above already confirms the key works ' +
        '(a bad key would have thrown, not returned an empty array). Try a different sport ID or date if you expected games.',
    );
  } else {
    console.log('\nKey is valid and returning real event/market data.');
  }
}

main().catch((error) => {
  console.error('\nVerification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
