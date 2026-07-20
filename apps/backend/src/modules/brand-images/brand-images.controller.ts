import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandImageSlot } from '@prisma/client';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { BrandImagesService } from './brand-images.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/brand-images')
export class BrandImagesController {
  constructor(private readonly brandImagesService: BrandImagesService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.brandImagesService.list(req.user.brandId);
  }

  @Post(':slot')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  async upload(
    @Param('slot', new ParseEnumPipe(BrandImageSlot)) slot: BrandImageSlot,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        `No image uploaded, or it wasn't one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return this.brandImagesService.setImage(req.user.brandId, slot, file.buffer, file.mimetype, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':slot')
  remove(
    @Param('slot', new ParseEnumPipe(BrandImageSlot)) slot: BrandImageSlot,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.brandImagesService.removeImage(req.user.brandId, slot, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
