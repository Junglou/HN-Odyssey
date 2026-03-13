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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { FilterOrderDto } from './dto/filter-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  InitGuestCheckoutDto,
  VerifyGuestOtpDto,
} from './dto/guest-checkout.dto';

// Decorators & Guards
import { Public } from '../../../common/decorators/public.decorator';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';

@ApiTags('Orders (Quản lý đơn hàng)')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // NHÓM 1: CÁC ROUTE TĨNH & PUBLIC
  // 1. TẠO ĐƠN HÀNG (Hỗ trợ cả Guest và Member)
  @Post()
  @Public() // Cho phép Guest
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Tạo đơn hàng mới (Cart hoặc BuyNow)' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ): Promise<any> {
    const userId = user ? user._id.toString() : null;
    const cleanIp = ip === '::1' || !ip ? '127.0.0.1' : ip;
    return this.ordersService.createOrder(userId, dto, cleanIp, userAgent);
  }

  // 3. INIT BUY NOW
  @Post('test/init-buy-now')
  @Public()
  @ApiOperation({ summary: 'Khởi tạo phiên mua ngay' })
  async initBuyNow(@Body() body: BuyNowDto) {
    return this.ordersService.createBuyNowSession(body);
  }

  // 4. GUEST CHECKOUT FLOW
  @Post('guest/init')
  @Public()
  @ApiOperation({ summary: 'Guest: Khởi tạo thanh toán & Gửi OTP' })
  async initGuestCheckout(@Body() dto: InitGuestCheckoutDto) {
    return this.ordersService.initGuestCheckout(dto);
  }

  @Post('guest/verify-otp')
  @Public()
  @ApiOperation({ summary: 'Guest: Xác thực OTP' })
  async verifyGuestOtp(@Body() dto: VerifyGuestOtpDto) {
    return this.ordersService.verifyGuestOtp(dto);
  }

  // 5. TÍNH TOÁN XEM TRƯỚC
  @Post('preview')
  @Public()
  @ApiOperation({ summary: 'Xem trước chi phí (Ship, Voucher...)' })
  async previewOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.previewOrder(dto);
  }

  // 6. IN HÀNG LOẠT
  @Post('print-bulk')
  @ApiOperation({ summary: 'In nhiều đơn hàng cùng lúc' })
  async printBulk(
    @Body('ids') ids: string[],
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }
    return this.ordersService.generateBulkPrintData(ids, type);
  }

  // 7. LẤY DANH SÁCH (Query Params)
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng (Filter/Sort)' })
  async findAll(@Query() query: FilterOrderDto) {
    return this.ordersService.findAll(query);
  }

  // NHÓM 2: CÁC ROUTE ĐỘNG (CÓ :id)

  // 8. CHI TIẾT ĐƠN HÀNG
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đơn hàng theo ID' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // 9. CẬP NHẬT TRẠNG THÁI
  @Patch(':id/status-advanced')
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng nâng cao' })
  async updateStatusAdvanced(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const actorName = user.fullName || user.email || 'Staff';
    return this.ordersService.updateStatusAdvanced(
      id,
      dto,
      user._id.toString(),
      actorName,
      ip,
      userAgent,
    );
  }

  // 10. LẤY DATA IN
  @Get(':id/print')
  @ApiOperation({ summary: 'Lấy dữ liệu để in hóa đơn/phiếu giao' })
  async printOrder(
    @Param('id') id: string,
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    return this.ordersService.generatePrintData(id, type);
  }

  // 11. GỬI EMAIL HÓA ĐƠN
  @Post(':id/send-invoice')
  @ApiOperation({ summary: 'Gửi lại email hóa đơn cho khách' })
  async sendInvoice(@Param('id') id: string) {
    return this.ordersService.sendInvoiceEmail(id);
  }
}
