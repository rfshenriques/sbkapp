import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { RolesGuard } from './roles.guard';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffBootstrapController } from './staff-bootstrap.controller';
import { StaffJwtAuthGuard } from './staff-jwt-auth.guard';
import { StaffJwtStrategy } from './staff-jwt.strategy';
import { StaffUsersController } from './staff-users.controller';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [
    StaffAuthController,
    StaffUsersController,
    StaffBootstrapController,
    AuditLogController,
  ],
  providers: [StaffAuthService, StaffJwtStrategy, StaffJwtAuthGuard, RolesGuard, AuditLogService],
  exports: [StaffJwtAuthGuard, RolesGuard, AuditLogService],
})
export class AdminModule {}
