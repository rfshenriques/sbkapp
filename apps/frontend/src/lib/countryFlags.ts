/**
 * Country -> flag emoji, keyed to the human-readable country names
 * odds-engine's normalizer actually produces (COUNTRY_BY_SPORT_KEY in
 * apps/odds-engine/src/providers/the-odds-api/normalize.ts). Flags are
 * built from real ISO 3166-1 alpha-2 / recognized region codes via Unicode
 * regional indicator symbols rather than hardcoding each emoji, so adding a
 * country is a one-line code lookup, not an emoji to track down.
 *
 * "World" and "International" aren't real countries (FIFA World Cup,
 * cross-border combat sports) - fall back to a globe rather than fabricate
 * a flag for them.
 */
const REGION_CODE_BY_COUNTRY: Record<string, string> = {
  England: 'GB',
  Spain: 'ES',
  Germany: 'DE',
  Italy: 'IT',
  France: 'FR',
  Netherlands: 'NL',
  Europe: 'EU',
  USA: 'US',
};

const GLOBE_FALLBACK = '🌍';

function regionCodeToFlagEmoji(regionCode: string): string {
  return regionCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function countryFlag(country: string): string {
  const regionCode = REGION_CODE_BY_COUNTRY[country];
  return regionCode ? regionCodeToFlagEmoji(regionCode) : GLOBE_FALLBACK;
}
