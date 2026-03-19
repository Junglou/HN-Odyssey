import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { GetStockDto } from './dto/get-stock.dto';
import { ManualAdjustDto } from './dto/manual-adjust.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ReportIssueDto } from './dto/report-issue.dto';
import { UpdateThresholdsDto } from './dto/update-thresholds.dto';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // [US1] Lấy danh sách tồn kho
  @UseGuards(JwtAuthGuard)
  @Get()
  async getStockList(@Query() query: GetStockDto) {
    return this.stockService.getStockList(query);
  }

  // [US2] Điều chỉnh thủ công
  @UseGuards(JwtAuthGuard)
  @Post('adjust-manual')
  async manualAdjust(
    @Body() dto: ManualAdjustDto,
    @Req() req: RequestWithUser,
  ) {
    // FIX: TypeScript giờ đã hiểu req có thể chứa user và id là string
    // Thêm fallback 'SYSTEM' để đề phòng trường hợp không lấy được ID
    const userId = req.user?.id || 'SYSTEM';
    return this.stockService.manualAdjust(dto, userId);
  }

  // [US4] Tiếp nhận đơn hàng
  @UseGuards(JwtAuthGuard)
  @Post('accept-orders')
  async acceptOrders(@Body() dto: AcceptOrderDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id || 'SYSTEM';
    return this.stockService.acceptOrders(dto, userId);
  }

  // [US3 - AC4] Thiết lập ngưỡng tồn kho Min/Max
  @UseGuards(JwtAuthGuard)
  @Post('thresholds')
  async updateThresholds(@Body() dto: UpdateThresholdsDto) {
    return this.stockService.updateThresholds(dto);
  }

  // [US4 - AC2] Báo cáo vấn đề đơn hàng (Tạm giữ/Phản hồi)
  @UseGuards(JwtAuthGuard)
  @Post('report-issue')
  async reportOrderIssue(
    @Body() dto: ReportIssueDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.id || 'SYSTEM';
    return this.stockService.reportOrderIssue(dto, userId);
  }

  // CÁC API HỆ THỐNG NỘI BỘ cua module khác
  @Public()
  @Post('hold')
  async holdStock(@Body() dto: AdjustStockDto) {
    return this.stockService.holdStock(dto);
  }

  @Public()
  @Post('deduct')
  async deductStock(@Body() dto: AdjustStockDto) {
    return this.stockService.finalizeDeduction(dto);
  }

  @Public()
  @Post('restock')
  async restock(@Body() dto: AdjustStockDto) {
    return this.stockService.restock(dto);
  }
}
