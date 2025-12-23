import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('inventory/stock')
// @UseGuards(JwtAuthGuard) // Bật lên khi cần bảo mật
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // API gọi khi Khách bấm "Thêm vào giỏ" hoặc "Đặt hàng"
  // Đáp ứng AC2 (Hold) & AC7 (Concurrency)
  @Public()
  @Post('hold')
  async holdStock(@Body() dto: AdjustStockDto) {
    return this.stockService.holdStock(dto);
  }

  // API gọi khi Thanh toán thành công (Webhook từ VNPAY/MOMO...)
  // Đáp ứng AC2 (Deduct)
  @Post('deduct')
  async deductStock(@Body() dto: AdjustStockDto) {
    return this.stockService.finalizeDeduction(dto);
  }

  // API gọi khi Khách hủy đơn hoặc Timeout thanh toán
  // Đáp ứng AC2 (Restock)
  @Post('restock')
  async restock(@Body() dto: AdjustStockDto) {
    return this.stockService.restock(dto);
  }
}
