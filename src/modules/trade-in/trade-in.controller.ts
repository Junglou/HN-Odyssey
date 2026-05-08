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
import {
  CreateTradeInRequestDto,
  AcceptValuationDto,
  InspectItemDto,
} from './dto/create-trade-in-request.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Resource, Action } from 'src/common/enums/resource.enum';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';

@Controller('trade-in')
export class TradeInController {
  constructor(private readonly tradeInService: TradeInService) {}

  //  CÚA KHÁCH HÀNG (AC1)
  @Post('request')
  @UseGuards(JwtAuthGuard) // Bắt buộc đăng nhập
  async createRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateTradeInRequestDto,
  ) {
    return this.tradeInService.createRequest(req.user._id, dto);
  }

  @Patch('request/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptValuation(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AcceptValuationDto,
  ) {
    return this.tradeInService.acceptValuation(req.user._id, id, dto);
  }

  //  CỦA ADMIN (AC9)
  @Patch('admin/request/:id/inspect')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.UPDATE)
  async inspectItem(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: InspectItemDto,
  ) {
    return this.tradeInService.inspectItem(req.user._id, id, dto);
  }

  @Patch('admin/request/:id/payout')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.APPROVE)
  async processPayout(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.tradeInService.processPayout(req.user._id, id);
  }

  //  API CHO AC7 (Khách hàng)
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

  //  API CHO AC9 (Admin)
  @Get('admin/requests')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.TRADE_IN, Action.READ)
  async getAdminRequests(@Query() query: QueryAdminTradeInDto) {
    return this.tradeInService.getAdminRequests(query);
  }
}
