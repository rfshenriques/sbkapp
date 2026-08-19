import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { ReorderPromoCardsDto } from './dto/reorder-promo-cards.dto';
import { UpdatePromoCardDto } from './dto/update-promo-card.dto';
import { PromoCardService } from './promo-card.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
  body: {
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    betAndGetCampaignId?: string;
    depositCampaignId?: string;
    registerCampaignId?: string;
    leaderboardCampaignId?: string;
  };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/promo-cards')
export class PromoCardAdminController {
  constructor(private readonly promoCardService: PromoCardService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.promoCardService.list(req.user.brandId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  async add(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: AuthenticatedStaffRequest) {
    if (!file) {
      throw new BadRequestException(`No image uploaded, or it wasn't one of: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    return this.promoCardService.add(
      req.user.brandId,
      file.buffer,
      file.mimetype,
      {
        title: req.body.title,
        subtitle: req.body.subtitle,
        ctaLabel: req.body.ctaLabel,
        betAndGetCampaignId: req.body.betAndGetCampaignId,
        depositCampaignId: req.body.depositCampaignId,
        registerCampaignId: req.body.registerCampaignId,
        leaderboardCampaignId: req.body.leaderboardCampaignId,
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoCardDto, @Req() req: AuthenticatedStaffRequest) {
    return this.promoCardService.update(req.user.brandId, id, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  /** Sets/replaces a card's image - the only way to give an auto-created card (see PromoCardAutoSyncService) its first piece of artwork after the fact. */
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  async updateImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (!file) {
      throw new BadRequestException(`No image uploaded, or it wasn't one of: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    return this.promoCardService.updateImage(req.user.brandId, id, file.buffer, file.mimetype, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post('reorder')
  reorder(@Body() dto: ReorderPromoCardsDto, @Req() req: AuthenticatedStaffRequest) {
    return this.promoCardService.reorder(req.user.brandId, dto.ids, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.promoCardService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
