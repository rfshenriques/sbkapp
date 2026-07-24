import { describe, expect, it, vi } from 'vitest';
import { createTheOddsApiClient } from './client';

function jsonResponse(body: unknown, init: Partial<{ ok: boolean; status: number; statusText: string }> = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('createTheOddsApiClient key fallback', () => {
  it('uses the first key when it succeeds, never touching the rest', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b'], fetchImpl });

    await client.getSports();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('apiKey=key-a');
  });

  it('falls through to the next key when the first key\'s response is not ok', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse([{ key: 'soccer_epl' }]));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b'], fetchImpl });

    const sports = await client.getSports();

    expect(sports).toEqual([{ key: 'soccer_epl' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toContain('apiKey=key-b');
  });

  it('falls through past a thrown network error, not just a non-ok response', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse([]));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b'], fetchImpl });

    await expect(client.getSports()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('tries every configured key before giving up, in order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401, statusText: 'Unauthorized' }));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b', 'key-c'], fetchImpl });

    await expect(client.getSports()).rejects.toThrow();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('apiKey=key-a');
    expect(String(fetchImpl.mock.calls[1]![0])).toContain('apiKey=key-b');
    expect(String(fetchImpl.mock.calls[2]![0])).toContain('apiKey=key-c');
  });

  it('once all keys fail, throws one clear error naming how many keys were tried', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 429, statusText: 'Too Many Requests' }));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b'], fetchImpl });

    await expect(client.getSports()).rejects.toThrow(/failed on all 2 configured key\(s\)/);
  });

  it('getOdds falls back through keys the same way as getSports', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse([]));
    const client = createTheOddsApiClient({ apiKeys: ['key-a', 'key-b'], fetchImpl });

    await expect(client.getOdds({ sportKey: 'soccer_epl' })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects construction with zero keys rather than silently doing nothing', () => {
    expect(() => createTheOddsApiClient({ apiKeys: [] })).toThrow('at least one API key');
  });
});
