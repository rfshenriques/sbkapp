import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService, type ReportRange } from './reports.service';

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@Query() query: ReportRangeQueryDto) {
    return this.reportsService.getSummary(toRange(query));
  }

  @Get('staff-activity')
  staffActivity(@Query() query: ReportRangeQueryDto) {
    return this.reportsService.getStaffActivity(toRange(query));
  }
}

function toRange(query: ReportRangeQueryDto): ReportRange {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}
