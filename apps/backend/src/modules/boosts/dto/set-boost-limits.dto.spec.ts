import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SetBoostLimitsDto } from './set-boost-limits.dto';

describe('SetBoostLimitsDto', () => {
  it('keeps staysLiveDuringInplay through validation under the app-wide whitelist ValidationPipe', async () => {
    // See SetManualMarketLimitsDto's identical test - main.ts's global
    // ValidationPipe (whitelist: true) silently deletes any property without
    // a validator decorator, so a field missing from this class would reach
    // the controller as undefined no matter what the client sent.
    const instance = plainToInstance(SetBoostLimitsDto, { staysLiveDuringInplay: true });

    const errors = await validate(instance, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(instance.staysLiveDuringInplay).toBe(true);
  });
});
