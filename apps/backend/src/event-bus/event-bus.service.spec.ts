import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EVENT_NAMES } from '@sportsbook/shared';
import { describe, expect, it } from 'vitest';
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  it('delivers a published event to its subscriber with id + occurredAt metadata', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [EventBusService],
    }).compile();
    const bus = moduleRef.get(EventBusService);

    const received: unknown[] = [];
    bus.subscribe(EVENT_NAMES.RISK_MARKET_AUTO_LOCKED, (payload, meta) => {
      received.push({ payload, meta });
    });

    const meta = bus.publish(EVENT_NAMES.RISK_MARKET_AUTO_LOCKED, {});

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ payload: {}, meta });
    expect(meta.id).toBeTruthy();
    expect(meta.occurredAt).toBeTruthy();
  });

  it('does not deliver events to subscribers of a different event name', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [EventBusService],
    }).compile();
    const bus = moduleRef.get(EventBusService);

    const received: unknown[] = [];
    bus.subscribe(EVENT_NAMES.FRAUD_FLAG_RAISED, (payload) => {
      received.push(payload);
    });

    bus.publish(EVENT_NAMES.RISK_MARKET_AUTO_LOCKED, {});

    expect(received).toHaveLength(0);
  });
});
