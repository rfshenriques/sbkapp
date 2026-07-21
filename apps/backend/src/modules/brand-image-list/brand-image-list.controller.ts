import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandImageListKind } from '@prisma/client';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { BrandImageListService } from './brand-image-list.service';
import { ReorderBrandImageListDto } from './dto/reorder-brand-image-list.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/brand-image-list')
export class BrandImageListController {
  constructor(private readonly brandImageListService: BrandImageListService) {}

  @Get()
  list(
    @Query('kind', new ParseEnumPipe(BrandImageListKind)) kind: BrandImageListKind,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.brandImageListService.list(req.user.brandId, kind);
  }

  @Post(':kind')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  async add(
    @Param('kind', new ParseEnumPipe(BrandImageListKind)) kind: BrandImageListKind,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        `No image uploaded, or it wasn't one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return this.brandImageListService.add(req.user.brandId, kind, file.buffer, file.mimetype, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post(':kind/reorder')
  reorder(
    @Param('kind', new ParseEnumPipe(BrandImageListKind)) kind: BrandImageListKind,
    @Body() dto: ReorderBrandImageListDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.brandImageListService.reorder(req.user.brandId, kind, dto.ids, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.brandImageListService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
