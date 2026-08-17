import { beforeEach, describe, expect, it } from 'vitest';
import { recordForcedLoginPromptShown, shouldShowForcedLoginPrompt } from './forcedLoginPrompt';

const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

describe('shouldShowForcedLoginPrompt', () => {
  it('is true when nothing has ever been recorded', () => {
    expect(shouldShowForcedLoginPrompt()).toBe(true);
  });

  it('is false right after recording', () => {
    const now = Date.now();
    recordForcedLoginPromptShown(now);

    expect(shouldShowForcedLoginPrompt(now)).toBe(false);
  });

  it('stays false less than an hour after the last recording', () => {
    const now = Date.now();
    recordForcedLoginPromptShown(now);

    expect(shouldShowForcedLoginPrompt(now + 59 * 60 * 1000)).toBe(false);
  });

  it('is true again once a full hour has passed', () => {
    const now = Date.now();
    recordForcedLoginPromptShown(now);

    expect(shouldShowForcedLoginPrompt(now + HOUR_MS)).toBe(true);
  });

  it('is true when the stored value is corrupt/non-numeric', () => {
    localStorage.setItem('sportsbook_last_forced_login_prompt_at', 'not-a-number');

    expect(shouldShowForcedLoginPrompt()).toBe(true);
  });
});
