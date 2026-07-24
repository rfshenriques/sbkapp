import { describe, expect, it } from 'vitest';
import { resolveAudience, type AudienceViewer } from './audience';

const anonymous: AudienceViewer = { isLoggedIn: false, segmentIds: [] };
const loggedIn: AudienceViewer = { isLoggedIn: true, segmentIds: [] };
const highRoller: AudienceViewer = { isLoggedIn: true, segmentIds: ['high-rollers'] };

describe('resolveAudience', () => {
  it('ALL is visible to everyone', () => {
    expect(resolveAudience('ALL', [], anonymous)).toBe(true);
    expect(resolveAudience('ALL', [], loggedIn)).toBe(true);
  });

  it('LOGGED_OUT is visible only to anonymous viewers', () => {
    expect(resolveAudience('LOGGED_OUT', [], anonymous)).toBe(true);
    expect(resolveAudience('LOGGED_OUT', [], loggedIn)).toBe(false);
  });

  it('LOGGED_IN is visible only to authenticated viewers', () => {
    expect(resolveAudience('LOGGED_IN', [], loggedIn)).toBe(true);
    expect(resolveAudience('LOGGED_IN', [], anonymous)).toBe(false);
  });

  it('SEGMENTS requires membership in at least one assigned segment', () => {
    expect(resolveAudience('SEGMENTS', ['high-rollers'], highRoller)).toBe(true);
    expect(resolveAudience('SEGMENTS', ['high-rollers'], loggedIn)).toBe(false);
    expect(resolveAudience('SEGMENTS', ['high-rollers'], anonymous)).toBe(false);
  });

  it('SEGMENTS is an OR match across multiple assigned segments', () => {
    expect(resolveAudience('SEGMENTS', ['vip', 'high-rollers'], highRoller)).toBe(true);
  });

  it('SEGMENTS with no assigned segments is visible to nobody', () => {
    expect(resolveAudience('SEGMENTS', [], highRoller)).toBe(false);
  });
});
