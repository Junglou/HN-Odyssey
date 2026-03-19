// src/modules/inventory/stock/stock.controller.ts

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StockService } from './stock.service';
import { GetStockDto } from './dto/get-stock.dto';
import { ManualAdjustDto } from './dto/manual-adjust.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { UpdateThresholdsDto } from './dto/update-thresholds.dto';
import { ReportIssueDto } from './dto/report-issue.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

interface RequestUser {
  email: string;
  roles: string[];
  userId: string;
}

interface RequestWithUser extends Request {
  user: RequestUser;
}

@Controller('inventory/stock')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // [US1] Lấy danh sách tồn kho (AC1)
  @Get()
  @RequirePermissions(Resource.INVENTORY, Action.READ)
  async getStockList(@Query() query: GetStockDto) {
    const data = await this.stockService.getStockList(query);
    return new BaseResponse(true, 'Lấy danh sách tồn kho thành công', data);
  }

  // [US2] Điều chỉnh thủ công (AC1, AC2, AC5)
  @Post('adjust-manual')
  @RequirePermissions(Resource.INVENTORY, Action.UPDATE)
  async manualAdjust(
    @Body() dto: ManualAdjustDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || 'SYSTEM';
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    return this.stockService.manualAdjust(dto, userId, ip, userAgent);
  }

  // [US4] Tiếp nhận đơn hàng (AC1, AC6, AC8)
  @Post('accept-orders')
  @RequirePermissions(Resource.TRANSFERS, Action.APPROVE)
  async acceptOrders(@Body() dto: AcceptOrderDto, @Req() req: RequestWithUser) {
    const userId = req.user?.userId || 'SYSTEM';
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    return this.stockService.acceptOrders(dto, userId, ip, userAgent);
  }

  // [US3 - AC4] Thiết lập ngưỡng tồn kho Min/Max
  @Post('thresholds')
  @RequirePermissions(Resource.INVENTORY, Action.UPDATE)
  async updateThresholds(
    @Body() dto: UpdateThresholdsDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || 'SYSTEM';
    return this.stockService.updateThresholds(dto, userId);
  }

  // [US4 - AC2] Báo cáo vấn đề đơn hàng
  @Post('report-issue')
  @RequirePermissions(Resource.TRANSFERS, Action.CANCEL)
  async reportOrderIssue(
    @Body() dto: ReportIssueDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.userId || 'SYSTEM';
    return this.stockService.reportOrderIssue(dto, userId);
  }

  // API NỘI BỘ HỆ THỐNG
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
