import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { MasterAuthController } from './master-auth.controller';
import { MasterAuthService } from './master-auth.service';
import { MasterBootstrapController } from './master-bootstrap.controller';
import { MasterJwtAuthGuard } from './master-jwt-auth.guard';
import { MasterJwtStrategy } from './master-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [MasterAuthController, MasterBootstrapController, BrandsController],
  providers: [MasterAuthService, MasterJwtStrategy, MasterJwtAuthGuard, BrandsService],
})
export class MasterModule {}
