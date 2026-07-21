import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportTimeSeriesQueryDto } from './dto/report-time-series-query.dto';
import { ReportsService, type ReportRange } from './reports.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@Query() query: ReportRangeQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.reportsService.getSummary(req.user.brandId, toRange(query));
  }

  @Get('staff-activity')
  staffActivity(@Query() query: ReportRangeQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.reportsService.getStaffActivity(req.user.brandId, toRange(query));
  }

  @Get('registrations-time-series')
  registrationsTimeSeries(
    @Query() query: ReportTimeSeriesQueryDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.reportsService.getRegistrationsTimeSeries(
      req.user.brandId,
      toRange(query),
      query.granularity,
    );
  }

  @Get('ggr-time-series')
  ggrTimeSeries(@Query() query: ReportTimeSeriesQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.reportsService.getGgrTimeSeries(req.user.brandId, toRange(query), query.granularity);
  }
}

function toRange(query: ReportRangeQueryDto): ReportRange {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}
