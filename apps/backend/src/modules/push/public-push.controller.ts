import { Controller, Get } from '@nestjs/common';

/**
 * Unauthenticated - the frontend needs the VAPID public key before a player
 * is necessarily logged in yet (it's read at PushManager.subscribe() time).
 * Deployment-wide, not brand-scoped - one VAPID keypair covers every brand
 * this backend serves, same precedent as PublicTeamColorsController.
 */
@Controller('public/push')
export class PublicPushController {
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string } {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('VAPID_PUBLIC_KEY must be set');
    }
    return { publicKey };
  }
}
