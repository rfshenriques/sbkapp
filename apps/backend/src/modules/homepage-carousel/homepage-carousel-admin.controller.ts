import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { HomepageCarouselService } from './homepage-carousel.service';
import { SetHomepageCarouselConfigDto } from './dto/set-homepage-carousel-config.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/homepage-carousel-config')
export class HomepageCarouselAdminController {
  constructor(private readonly homepageCarouselService: HomepageCarouselService) {}

  @Get()
  get(@Req() req: AuthenticatedStaffRequest) {
    return this.homepageCarouselService.getConfig(req.user.brandId);
  }

  @Put()
  set(@Body() dto: SetHomepageCarouselConfigDto, @Req() req: AuthenticatedStaffRequest) {
    return this.homepageCarouselService.setConfig(req.user.brandId, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
