import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetStakeLimitDto } from './dto/set-stake-limit.dto';
import { StakeLimitService } from './stake-limit.service';
import { buildStakeLimitWorkbook, parseStakeLimitWorkbook, StakeLimitWorkbookError } from './stake-limit-workbook';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/stake-limits')
export class StakeLimitAdminController {
  constructor(private readonly stakeLimitService: StakeLimitService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.list(req.user.brandId);
  }

  /**
   * Downloads the brand's current limits as an .xlsx a trader can edit and
   * re-upload via POST .../import - the same file, round-tripped, is the
   * intended workflow ("download, edit, re-upload").
   */
  @Get('export')
  async export(@Req() req: AuthenticatedStaffRequest, @Res({ passthrough: true }) res: Response) {
    const rows = await this.stakeLimitService.list(req.user.brandId);
    const buffer = await buildStakeLimitWorkbook(rows);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="stake-limits.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  /**
   * The uploaded file becomes the brand's whole limit set - a row removed
   * from the spreadsheet before re-upload is removed from the brand's
   * limits too (see StakeLimitService.bulkReplace). The newest uploaded
   * file always wins; there's no merge with whatever was there before.
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  async import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    let rows;
    try {
      rows = await parseStakeLimitWorkbook(file.buffer);
    } catch (error) {
      if (error instanceof StakeLimitWorkbookError) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Could not read the uploaded file - is it a valid .xlsx?');
    }

    return this.stakeLimitService.bulkReplace(req.user.brandId, rows, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post()
  set(@Body() dto: SetStakeLimitDto, @Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.set(
      req.user.brandId,
      {
        scope: dto.scope,
        scopeValue: dto.scopeValue,
        tier: dto.tier,
        maxStakeCents: dto.maxStakeCents ?? null,
        maxLiabilityCents: dto.maxLiabilityCents ?? null,
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.stakeLimitService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
