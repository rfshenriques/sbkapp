import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from './roles.guard';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtAuthGuard } from './staff-jwt-auth.guard';
import { StaffJwtStrategy } from './staff-jwt.strategy';
import { StaffUsersController } from './staff-users.controller';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [StaffAuthController, StaffUsersController],
  providers: [StaffAuthService, StaffJwtStrategy, StaffJwtAuthGuard, RolesGuard],
  exports: [StaffJwtAuthGuard, RolesGuard],
})
export class AdminModule {}
