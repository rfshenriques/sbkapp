import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { StaffJwtAuthGuard } from './staff-jwt-auth.guard';

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogQueryDto) {
    return this.auditLogService.listEntries(query.limit);
  }
}
