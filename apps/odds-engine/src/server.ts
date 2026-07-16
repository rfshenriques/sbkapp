import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';

export interface OddsEngineOptions {
  /** How often to push a stub odds tick to connected clients. */
  tickIntervalMs?: number;
}

export interface OddsEngine {
  httpServer: Server;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * Standalone real-time odds/trading service stub (see docs/PROJECT_BRIEF.md,
 * Section 4). Currently just proves the shape: HTTP health check + a
 * WebSocket stream pushing stub ticks. Real market data, and wiring this
 * onto the cross-process event bus, land in Phase 3.
 */
export function createOddsEngine(options: OddsEngineOptions = {}): OddsEngine {
  const tickIntervalMs = options.tickIntervalMs ?? 5000;

  const httpServer = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/odds' });

  wss.on('connection', (socket) => {
    const interval = setInterval(() => {
      socket.send(JSON.stringify({ type: 'odds.stub_tick', occurredAt: new Date().toISOString() }));
    }, tickIntervalMs);

    socket.on('close', () => clearInterval(interval));
  });

  return {
    httpServer,
    listen: (port: number) =>
      new Promise<void>((resolve) => {
        httpServer.listen(port, resolve);
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close();
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  void createOddsEngine().listen(port);
}
