import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FreebetModule } from '../freebets/freebet.module';
import { RegisterCampaignModule } from '../register-campaigns/register-campaign.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OptionalPlayerAuthService } from './optional-player-auth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET }),
    }),
    FreebetModule,
    RegisterCampaignModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OptionalPlayerAuthService],
  exports: [AuthService, OptionalPlayerAuthService],
})
export class AuthModule {}
