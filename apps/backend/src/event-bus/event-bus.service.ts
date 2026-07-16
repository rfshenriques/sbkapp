import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EventName, EventPayloadMap } from '@sportsbook/shared';

export interface EventMeta {
  id: string;
  occurredAt: string;
}

export type EventHandler<TName extends EventName> = (
  payload: EventPayloadMap[TName],
  meta: EventMeta,
) => void | Promise<void>;

/**
 * Internal event bus. In-process (EventEmitter2) for now; modules depend on
 * this service rather than on EventEmitter2 directly so the transport can be
 * swapped for Redis/NATS/Kafka later without touching module code (see
 * docs/PROJECT_BRIEF.md, Section 4).
 */
@Injectable()
export class EventBusService {
  constructor(private readonly emitter: EventEmitter2) {}

  publish<TName extends EventName>(name: TName, payload: EventPayloadMap[TName]): EventMeta {
    const meta: EventMeta = { id: randomUUID(), occurredAt: new Date().toISOString() };
    this.emitter.emit(name, payload, meta);
    return meta;
  }

  subscribe<TName extends EventName>(name: TName, handler: EventHandler<TName>): void {
    this.emitter.on(name, handler);
  }
}
