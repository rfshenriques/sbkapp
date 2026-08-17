import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandLogoSlot } from '@prisma/client';
import { BrandsService } from './brands.service';
import { CreateBrandDto, SetProductFlagDto, UpdateBrandDto } from './dto/create-brand.dto';
import { KNOWN_PRODUCTS } from './dto/known-products';
import { MasterJwtAuthGuard } from './master-jwt-auth.guard';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

@UseGuards(MasterJwtAuthGuard)
@Controller('master/brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  listBrands() {
    return this.brandsService.listBrands();
  }

  @Post()
  createBrand(@Body() dto: CreateBrandDto) {
    return this.brandsService.createBrand(dto);
  }

  @Get(':id')
  getBrand(@Param('id') id: string) {
    return this.brandsService.getBrand(id);
  }

  @Patch(':id')
  updateBrand(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.updateBrand(id, dto);
  }

  @Patch(':id/products/:product')
  setProductFlag(
    @Param('id') id: string,
    @Param('product') product: string,
    @Body() dto: SetProductFlagDto,
  ) {
    if (!KNOWN_PRODUCTS.includes(product as (typeof KNOWN_PRODUCTS)[number])) {
      throw new BadRequestException(`Unknown product "${product}"`);
    }
    return this.brandsService.setProductFlag(id, product, dto.enabled);
  }

  @Post(':id/logo/:slot')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LOGO_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    @Param('slot', new ParseEnumPipe(BrandLogoSlot)) slot: BrandLogoSlot,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(
        `No logo uploaded, or it wasn't one of: ${ALLOWED_LOGO_MIME_TYPES.join(', ')}`,
      );
    }
    return this.brandsService.setLogo(id, slot, file.buffer, file.mimetype);
  }

  @Delete(':id/logo/:slot')
  removeLogo(@Param('id') id: string, @Param('slot', new ParseEnumPipe(BrandLogoSlot)) slot: BrandLogoSlot) {
    return this.brandsService.removeLogo(id, slot);
  }
}
