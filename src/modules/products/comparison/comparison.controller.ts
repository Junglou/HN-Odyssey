import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { CompareProductsDto } from './dto/add-comparison.dto';

@Controller('products/compare')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  // AC4, AC5, AC10: API trả về ma trận dữ liệu để Frontend vẽ bảng
  @Post('matrix')
  async getComparisonMatrix(@Body() dto: CompareProductsDto) {
    return this.comparisonService.buildComparisonMatrix(dto.product_ids);
  }

  // AC11: Gợi ý sản phẩm tương tự để thêm vào so sánh
  @Get('suggestions/:productId')
  async getSuggestions(@Param('productId') productId: string) {
    return this.comparisonService.getSimilarProducts(productId);
  }
}
