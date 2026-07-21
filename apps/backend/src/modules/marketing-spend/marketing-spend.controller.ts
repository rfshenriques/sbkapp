import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { ReportRangeQueryDto } from '../reports/dto/report-range-query.dto';
import { CreateMarketingSpendDto } from './dto/create-marketing-spend.dto';
import { MarketingSpendService } from './marketing-spend.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/marketing-spend')
export class MarketingSpendController {
  constructor(private readonly marketingSpendService: MarketingSpendService) {}

  @Get()
  list(@Query() query: ReportRangeQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.marketingSpendService.list(req.user.brandId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateMarketingSpendDto, @Req() req: AuthenticatedStaffRequest) {
    return this.marketingSpendService.create(
      req.user.brandId,
      { date: new Date(dto.date), channel: dto.channel, amountCents: dto.amountCents },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.marketingSpendService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
