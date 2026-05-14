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
} from '@nestjs/common';
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

  @Patch('admin/request/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async receiveItem(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.tradeInService.receiveItem(req.user._id, id);
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
}
