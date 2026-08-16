import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { ReportRangeQueryDto } from '../reports/dto/report-range-query.dto';
import { AnalyticsService } from './analytics.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Polled by the backoffice's live panel every few seconds - see apps/backoffice's AnalyticsPage. */
  @Get('live')
  live(@Req() req: AuthenticatedStaffRequest) {
    return this.analyticsService.getLiveSnapshot(req.user.brandId);
  }

  @Get('summary')
  summary(@Query() query: ReportRangeQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.analyticsService.getSummary(req.user.brandId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
