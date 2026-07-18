import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto, SetProductFlagDto, UpdateBrandDto } from './dto/create-brand.dto';
import { KNOWN_PRODUCTS } from './dto/known-products';
import { MasterJwtAuthGuard } from './master-jwt-auth.guard';

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
}
