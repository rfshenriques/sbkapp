import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { resolveRpContext } from './rp-context';

function fakeRequest(headers: Record<string, string | undefined>, protocol = 'https'): Request {
  return { headers, protocol } as unknown as Request;
}

describe('resolveRpContext', () => {
  it('prefers the Origin header, deriving rpId from its hostname', () => {
    const { rpId, origin } = resolveRpContext(fakeRequest({ origin: 'https://www.mysportsbook.com' }));

    expect(rpId).toBe('www.mysportsbook.com');
    expect(origin).toBe('https://www.mysportsbook.com');
  });

  it('falls back to the Host header when Origin is missing', () => {
    const { rpId, origin } = resolveRpContext(fakeRequest({ host: 'localhost:5173' }));

    expect(rpId).toBe('localhost');
    expect(origin).toBe('https://localhost:5173');
  });

  it('throws when neither Origin nor Host is present', () => {
    expect(() => resolveRpContext(fakeRequest({}))).toThrow(BadRequestException);
  });
});
