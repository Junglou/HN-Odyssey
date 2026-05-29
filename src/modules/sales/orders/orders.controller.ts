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
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { OrderStatus } from 'src/common/interfaces/order.interface';

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

  // 6. IN HÀNG LOẠT (TRẢ VỀ FILE PDF)
  @Post('print-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'In nhiều đơn hàng cùng lúc (Tải PDF)' })
  async printBulk(
    @Body('ids') ids: string[],
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
    @Res() res: Response, // Lấy Object Response để stream file
  ): Promise<void> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID không hợp lệ');
    }
    // Chuyển giao toàn bộ Request cho Service xử lý File
    await this.ordersService.downloadBulkPdf(ids, type || 'INVOICE', res);
  }

  // 7. LẤY DANH SÁCH (Query Params)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng (Filter/Sort)' })
  async findAll(@Query() query: FilterOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Get('export/excel')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Xuất dữ liệu đơn hàng ra Excel' })
  async exportExcel(
    @Query() query: FilterOrderDto,
    @CurrentUser() user: IUser, // Bổ sung tham số lấy thông tin người dùng hiện tại
    @Res() res: Response,
  ): Promise<void> {
    const adminId = user._id.toString();
    await this.ordersService.exportExcel(adminId, query, res);
  }

  // NHÓM 2: CÁC ROUTE ĐỘNG (CÓ :id)

  // 8. CHI TIẾT ĐƠN HÀNG
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Xem chi tiết đơn hàng theo ID' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // 9. CẬP NHẬT TRẠNG THÁI
  @Patch(':id/status-advanced')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.UPDATE)
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Lấy dữ liệu để in hóa đơn/phiếu giao' })
  async printOrder(
    @Param('id') id: string,
    @Query('type') type: 'INVOICE' | 'PACKING_SLIP',
  ) {
    return this.ordersService.generatePrintData(id, type);
  }

  // 11. GỬI EMAIL HÓA ĐƠN
  @Post(':id/send-invoice')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Gửi lại email hóa đơn cho khách' })
  async sendInvoice(@Param('id') id: string) {
    return this.ordersService.sendInvoiceEmail(id);
  }

  // INTERNAL API CHO AI AGENT (n8n) SỬ DỤNG
  @Get('internal/chatbot/tracking')
  @Public()
  @ApiOperation({ summary: 'API nội bộ cho Chatbot tra cứu đơn hàng' })
  async chatbotTrackOrder(
    @Query('order_code') orderCode?: string,
    @Query('phone') phone?: string,
  ) {
    // 1. DỌN DẸP DỮ LIỆU TỪ AI (Xóa ngoặc kép, ngoặc đơn, khoảng trắng thừa)
    const cleanOrderCode = orderCode
      ? orderCode.replace(/['"]/g, '').trim()
      : undefined;
    const cleanPhone = phone ? phone.replace(/['"]/g, '').trim() : undefined;

    // 2. LOG ĐỂ KIỂM CHỨNG
    console.log('\n--- N8N CHATBOT GỌI API TRA CỨU ---');
    console.log('Mã gốc n8n gửi:', orderCode);
    console.log('Mã đã làm sạch:', cleanOrderCode);

    if (!cleanOrderCode && !cleanPhone) {
      throw new BadRequestException('Vui lòng cung cấp order_code hoặc phone');
    }

    // 3. GỌI HÀM TÌM KIẾM
    const orders = await this.ordersService.findForChatbot(
      cleanOrderCode,
      cleanPhone,
    );

    if (!orders || orders.length === 0) {
      return {
        found: false,
        message: 'Không tìm thấy đơn hàng nào khớp với thông tin cung cấp.',
      };
    }

    // Format lại dữ liệu cho AI dễ đọc
    const ordersData = orders.map((order) => ({
      order_code: order.order_code,
      status: order.status,
      created_at: order.createdAt,
      total_amount: order.total_amount,
      items: order.items
        .map((i) => `${i.quantity}x ${i.product_name}`)
        .join(', '),
      shipping_info: {
        address: order.shipping_info?.address || 'Nhận tại cửa hàng',
        tracking_code: order.shipping_info?.tracking_code || 'Chưa có',
      },
      payment_method: order.payment?.method || 'COD',
      payment_status: order.payment?.status || 'PENDING',
    }));

    return { found: true, orders: ordersData };
  }

  // 12. LẤY LINK IN TEM VẬN CHUYỂN (GHN/GHTK)
  @Get(':id/shipping-label')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.READ)
  @ApiOperation({ summary: 'Lấy link in tem vận chuyển từ ĐVVC (GHN/GHTK)' })
  async getShippingLabel(@Param('id') id: string) {
    return this.ordersService.getShippingLabel(id);
  }

  // 13. NHẬN WEBHOOK TỪ ĐƠN VỊ VẬN CHUYỂN
  @Post('webhook/shipping')
  @Public()
  @ApiOperation({ summary: 'Webhook nhận cập nhật trạng thái từ ĐVVC' })
  async handleShippingWebhook(
    @Body('waybill_code') waybillCode: string,
    @Body('status') status: OrderStatus,
  ) {
    if (!waybillCode || !status) {
      throw new BadRequestException(
        'Dữ liệu webhook không hợp lệ (thiếu waybill_code hoặc status)',
      );
    }
    return this.ordersService.updateStatusByWaybill(waybillCode, status);
  }
}
