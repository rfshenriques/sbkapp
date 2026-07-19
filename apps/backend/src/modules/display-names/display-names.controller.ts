import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DisplayNameEntityType } from '@prisma/client';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetDisplayNameDto } from './dto/set-display-name.dto';
import { SyncDisplayNamesDto } from './dto/sync-display-names.dto';
import { DisplayNamesService } from './display-names.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

/** Not brand-scoped (see DisplayNameOverride's schema comment) - but still gated behind staff auth, since editing a shared name affects every brand at once. */
@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/display-names')
export class DisplayNamesController {
  constructor(private readonly displayNamesService: DisplayNamesService) {}

  @Get()
  list(@Query('entityType') entityType?: string) {
    if (entityType && !Object.values(DisplayNameEntityType).includes(entityType as DisplayNameEntityType)) {
      throw new BadRequestException(`Unknown entityType: ${entityType}`);
    }
    return this.displayNamesService.list(entityType as DisplayNameEntityType | undefined);
  }

  @Post('sync')
  sync(@Body() dto: SyncDisplayNamesDto) {
    return this.displayNamesService.syncNames(dto.entityType, dto.names);
  }

  @Patch(':id')
  setDisplayName(
    @Param('id') id: string,
    @Body() dto: SetDisplayNameDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (dto.displayName === undefined) {
      throw new BadRequestException('displayName is required');
    }

    return this.displayNamesService.setDisplayName(id, dto.displayName, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
