import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Get,
  Query,
  Patch,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TradeInService, QueryAdminTradeInDto } from './trade-in.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import {
  CancelTradeInDto,
  CreateTradeInRequestDto,
  FinalizeTradeInDto,
  GhnWebhookPayloadDto,
  RejectTradeInDto,
} from './/dto/trade-in.dto.ts';

@Controller('trade-in')
export class TradeInController {
  constructor(private readonly tradeInService: TradeInService) {}

  // --- API CỦA KHÁCH HÀNG ---
  @Post('request')
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateTradeInRequestDto,
  ) {
    return this.tradeInService.createRequest(req.user._id, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getMyHistory(@Req() req: RequestWithUser) {
    return this.tradeInService.getCustomerHistory(req.user._id);
  }

  @Get('history/:id')
  @UseGuards(JwtAuthGuard)
  async getMyRequestDetail(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.tradeInService.getCustomerRequestDetail(req.user._id, id);
  }

  @Patch('request/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelMyRequest(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CancelTradeInDto,
  ) {
    return this.tradeInService.cancelRequest(req.user._id, id, dto, false);
  }

  // --- API CỦA ADMIN (Khớp 1:1 với FE) ---
  @Get('admin/requests')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.READ)
  async getAdminRequests(@Query() query: QueryAdminTradeInDto) {
    return this.tradeInService.getAdminRequests(query);
  }

  @Patch('admin/request/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async approveTradeIn(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.tradeInService.approveTradeIn(req.user._id, id);
  }

  @Patch('admin/request/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async rejectTradeIn(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: RejectTradeInDto,
  ) {
    return this.tradeInService.rejectTradeIn(req.user._id, id, dto);
  }

  @Patch('admin/request/:id/create-order')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async createOrder(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.tradeInService.createOrder(req.user._id, id);
  }

  @Patch('admin/request/:id/finalize')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.APPROVE)
  async finalizeValue(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: FinalizeTradeInDto,
  ) {
    return this.tradeInService.finalizeValue(req.user._id, id, dto);
  }

  // 1. API Lấy chi tiết đơn Trade-In cho Admin
  @Get('admin/request/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.READ)
  async getAdminRequestDetail(@Param('id') id: string) {
    return this.tradeInService.getAdminRequestDetail(id);
  }

  // 2. API Xuất Excel
  @Get('admin/export/excel')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.READ)
  async exportExcel(
    @Req() req: RequestWithUser,
    @Query() query: QueryAdminTradeInDto,
    @Res() res: Response,
  ): Promise<void> {
    const adminId = String(req.user._id);
    await this.tradeInService.exportExcel(adminId, query, res);
  }

  // 3. API In ấn hàng loạt (Hóa đơn / Phiếu kiểm định)
  @Post('admin/print-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.READ)
  async printBulk(
    @Body('ids') ids: string[],
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
    @Res() res: Response,
  ): Promise<void> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }
    await this.tradeInService.downloadBulkPdf(ids, type || 'PACKING_SLIP', res);
  }

  @Post('webhook/ghn')
  async handleGhnWebhook(@Body() payload: GhnWebhookPayloadDto) {
    await this.tradeInService.handleGhnWebhook(payload);
    // Trả về HTTP 200 ngay lập tức để GHN biết hệ thống đã ghi nhận
    return { success: true };
  }

  @Patch('admin/request/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async receiveItem(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.tradeInService.receiveItem(req.user._id, id);
  }

  // ĐÃ FIX: Đồng bộ Guard và Type an toàn cho Sandbox
  @Patch('admin/request/:id/sandbox-receive')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async sandboxReceive(@Req() req: RequestWithUser, @Param('id') id: string) {
    const adminId = String(req.user._id);
    return this.tradeInService.sandboxReceiveItem(adminId, id);
  }
}
