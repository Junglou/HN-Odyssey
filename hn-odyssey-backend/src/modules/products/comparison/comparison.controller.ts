import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { CompareProductsDto } from './dto/add-comparison.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('products/compare')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Public()
  @Post('matrix')
  async getComparisonMatrix(@Body() dto: CompareProductsDto) {
    return this.comparisonService.buildComparisonMatrix(dto.product_ids);
  }

  @Public()
  @Get('suggestions/:productId')
  async getSuggestions(@Param('productId') productId: string) {
    return this.comparisonService.getSimilarProducts(productId);
  }
}
