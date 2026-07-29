/**
 * How many days after a player's own signup a qualifying bet must land to
 * still fulfill a requiresBet RegisterCampaign - the "max days" window from
 * the business requirement. Inclusive of the deadline instant itself.
 */
export function isWithinQualifyingBetWindow(
  userCreatedAt: Date,
  windowDays: number,
  now: Date = new Date(),
): boolean {
  const deadline = new Date(userCreatedAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return now <= deadline;
}
