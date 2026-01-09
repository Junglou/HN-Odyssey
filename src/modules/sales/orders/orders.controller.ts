import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
  Ip,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';
import { BuyNowDto } from './dto/buy-now.dto';
import { FilterOrderDto } from './dto/filter-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    return this.ordersService.createOrder(userId, dto, ip, userAgent);
  }

  // US.121: Lấy danh sách đơn hàng (Admin/Staff)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(@Query() query: FilterOrderDto) {
    return this.ordersService.findAll(query);
  }

  // US.122: Xem chi tiết đơn hàng
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Public()
  @Post('test/init-buy-now')
  async initBuyNow(@Body() body: BuyNowDto) {
    return this.ordersService.createBuyNowSession(body);
  }

  // US.123: Cập nhật trạng thái nâng cao
  @Patch(':id/status-advanced')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateStatusAdvanced(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const actorName = user['name'] || user['email'] || 'Staff';
    return this.ordersService.updateStatusAdvanced(
      id,
      dto,
      user._id,
      actorName,
      ip,
      userAgent,
    );
  }

  // US.124: Lấy dữ liệu in (Hóa đơn / Phiếu xuất)
  @Get(':id/print')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async printOrder(
    @Param('id') id: string,
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    return this.ordersService.generatePrintData(id, type);
  }

  // US.124 AC3: Gửi hóa đơn qua email
  @Post(':id/send-invoice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async sendInvoice(@Param('id') id: string) {
    return this.ordersService.sendInvoiceEmail(id);
  }

  // US.124 AC4: In hàng loạt
  @Post('print-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async printBulk(
    @Body('ids') ids: string[],
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }
    return this.ordersService.generateBulkPrintData(ids, type);
  }
}
