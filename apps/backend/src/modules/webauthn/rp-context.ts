import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export interface RpContext {
  rpId: string;
  origin: string;
}

/**
 * WebAuthn's rpID must be the exact hostname the ceremony is running on,
 * and expectedOrigin the exact scheme+host(+port) - derived per-request
 * from the incoming Origin (falling back to Host) rather than a single
 * configured value, since this app runs one deployment serving many
 * brands' own domains (see PublicBrandController's by-domain resolution).
 * A static env var would only ever be correct for one of them.
 */
export function resolveRpContext(req: Request): RpContext {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string') {
    return { rpId: new URL(originHeader).hostname, origin: originHeader };
  }

  const host = req.headers.host;
  if (typeof host === 'string') {
    return { rpId: host.split(':')[0]!, origin: `${req.protocol}://${host}` };
  }

  throw new BadRequestException('Cannot resolve request origin for WebAuthn');
}
