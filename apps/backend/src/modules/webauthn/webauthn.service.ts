import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { AuthTokens } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface WebAuthnCredentialSummary {
  id: string;
  nickname: string | null;
  deviceType: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async generateRegistrationOptionsForUser(
    userId: string,
    rpId: string,
    rpName: string,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const existingCredentials = await this.prisma.webAuthnCredential.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: user.username,
      userID: Buffer.from(user.id, 'utf8'),
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      })),
      // residentKey 'required' is what makes the credential discoverable -
      // the login side never sends allowCredentials, so the authenticator
      // needs to be able to surface this credential on its own.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });

    await this.storeChallenge(options.challenge, userId);
    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    rpId: string,
    origin: string,
  ): Promise<WebAuthnCredentialSummary> {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) => this.consumeChallenge(challenge, userId),
      expectedOrigin: origin,
      expectedRPID: rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration could not be verified');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const saved = await this.prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    });

    return {
      id: saved.id,
      nickname: saved.nickname,
      deviceType: saved.deviceType,
      createdAt: saved.createdAt,
      lastUsedAt: saved.lastUsedAt,
    };
  }

  /** No allowCredentials - a discoverable-credential/usernameless flow, so any resident passkey registered for this RP can respond. */
  async generateLoginOptions(rpId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'preferred',
    });

    await this.storeChallenge(options.challenge, null);
    return options;
  }

  async verifyLogin(response: AuthenticationResponseJSON, rpId: string, origin: string): Promise<AuthTokens> {
    const stored = await this.prisma.webAuthnCredential.findUnique({
      where: { credentialId: response.id },
    });
    if (!stored) {
      throw new UnauthorizedException('Unknown passkey');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (challenge) => this.consumeChallenge(challenge, null),
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: stored.credentialId,
        publicKey: stored.publicKey,
        counter: stored.counter,
        transports: stored.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey could not be verified');
    }

    await this.prisma.webAuthnCredential.update({
      where: { id: stored.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });

    return this.authService.loginWithUserId(stored.userId);
  }

  async listCredentials(userId: string): Promise<WebAuthnCredentialSummary[]> {
    const credentials = await this.prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return credentials.map((credential) => ({
      id: credential.id,
      nickname: credential.nickname,
      deviceType: credential.deviceType,
      createdAt: credential.createdAt,
      lastUsedAt: credential.lastUsedAt,
    }));
  }

  async removeCredential(userId: string, credentialId: string): Promise<void> {
    const credential = await this.prisma.webAuthnCredential.findUnique({ where: { id: credentialId } });
    if (!credential || credential.userId !== userId) {
      throw new BadRequestException('Passkey not found');
    }
    await this.prisma.webAuthnCredential.delete({ where: { id: credentialId } });
  }

  private async storeChallenge(challenge: string, userId: string | null): Promise<void> {
    await this.prisma.webAuthnChallenge.create({
      data: { challenge, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
  }

  /** Single-use: a matching, unexpired, correctly-scoped challenge is deleted the moment it's checked, whether or not the surrounding verification ultimately succeeds. */
  private async consumeChallenge(challenge: string, expectedUserId: string | null): Promise<boolean> {
    const row = await this.prisma.webAuthnChallenge.findUnique({ where: { challenge } });
    if (!row || row.expiresAt < new Date() || row.userId !== expectedUserId) {
      return false;
    }
    await this.prisma.webAuthnChallenge.delete({ where: { id: row.id } });
    return true;
  }
}
