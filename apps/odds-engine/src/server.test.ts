import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createOddsEngine, type OddsEngine } from './server';

describe('odds engine stub', () => {
  let engine: OddsEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it('responds to a health check', async () => {
    engine = createOddsEngine();
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('streams stub odds ticks over the websocket connection', async () => {
    engine = createOddsEngine({ tickIntervalMs: 10 });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/odds`);
      socket.once('message', (data) => {
        resolve(data.toString());
        socket.close();
      });
      socket.once('error', reject);
    });

    expect(JSON.parse(message)).toMatchObject({ type: 'odds.stub_tick' });
  });
});
