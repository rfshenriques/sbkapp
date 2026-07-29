/**
 * Masks a username to its first 3 characters + literal '****' - what every
 * OTHER player's leaderboard row shows (see LeaderboardCampaignService.
 * getRankedEntries / the public entries controller). Applied server-side,
 * before the real username ever reaches the wire for anyone but the
 * viewer's own entry - actual privacy, not just UI hiding.
 *
 * Uses Array.from rather than String.slice so the 3-character prefix is
 * measured in Unicode code points, not UTF-16 code units - slicing raw
 * UTF-16 could otherwise cut a surrogate pair (e.g. an emoji in a
 * username) in half and produce a broken/replacement glyph. Usernames
 * shorter than 3 characters aren't special-cased - the prefix is just
 * whatever's there (0-2 chars), always followed by '****'.
 */
export function maskUsername(username: string): string {
  return `${Array.from(username).slice(0, 3).join('')}****`;
}
