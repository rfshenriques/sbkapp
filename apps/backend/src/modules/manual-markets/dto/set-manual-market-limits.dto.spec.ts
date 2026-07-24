import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SetManualMarketLimitsDto } from './set-manual-market-limits.dto';

describe('SetManualMarketLimitsDto', () => {
  it('keeps staysLiveDuringInplay and singlesOnly through validation under the app-wide whitelist ValidationPipe', async () => {
    // The app's global ValidationPipe uses whitelist: true (see main.ts), which
    // silently deletes any property without a validator decorator - a field
    // missing from this class would reach the controller as undefined no
    // matter what the client sent, exactly the bug that left the backoffice's
    // "Will be live" checkbox doing nothing.
    const instance = plainToInstance(SetManualMarketLimitsDto, {
      staysLiveDuringInplay: true,
      singlesOnly: true,
    });

    const errors = await validate(instance, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(instance.staysLiveDuringInplay).toBe(true);
    expect(instance.singlesOnly).toBe(true);
  });
});
