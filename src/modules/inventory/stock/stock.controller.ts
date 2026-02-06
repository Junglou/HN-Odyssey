import { Body, Controller, Post } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('inventory/stock')
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
  @Public()
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
