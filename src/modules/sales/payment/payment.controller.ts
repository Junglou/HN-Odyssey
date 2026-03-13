import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { VnpayReturnParams } from 'src/common/interfaces/order.interface';
import { PaymentConfig } from './schemas/payment-config.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Resource, Action } from 'src/common/enums/resource.enum';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('vnpay-ipn')
  @Public()
  @ApiOperation({ summary: 'Webhook xử lý kết quả thanh toán từ VNPAY' })
  async vnpayIpn(@Query() query: Record<string, unknown>) {
    return this.paymentService.handleIpn('VNPAY', query);
  }

  @Get('vnpay-return')
  @Public()
  @ApiOperation({ summary: 'Xử lý redirect từ VNPAY về Frontend' })
  async vnpayReturn(@Query() query: VnpayReturnParams, @Res() res: Response) {
    try {
      const isValid = await this.paymentService.verifyReturnUrl(query);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const txnRef = query.vnp_TxnRef;
      const responseCode = query.vnp_ResponseCode;

      if (isValid && responseCode === '00') {
        return res.redirect(`${frontendUrl}/checkout/success?code=${txnRef}`);
      } else {
        return res.redirect(
          `${frontendUrl}/checkout/fail?code=${txnRef}&status=failed`,
        );
      }
    } catch (error) {
      console.error('VNPAY Return Error:', error);

      // Fallback nếu lỗi hệ thống
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/checkout/fail?error=system_error`);
    }
  }

  @Public()
  @Get('methods')
  @ApiOperation({
    summary: 'Lấy danh sách các phương thức thanh toán đang bật',
  })
  getPaymentMethods() {
    return {
      data: [
        {
          code: 'COD',
          name: 'Thanh toán khi nhận hàng',
          icon: 'https://cdn-icons-png.flaticon.com/512/2331/2331941.png',
          is_active: true,
        },
        {
          code: 'VNPAY',
          name: 'VNPAY - QR / Thẻ ATM / Tài khoản ngân hàng',
          icon: 'https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png',
          is_active: true,
        },
        {
          code: 'MOMO',
          name: 'Ví điện tử MoMo',
          icon: 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
          is_active: false,
        },
      ],
    };
  }

  // MOMO ENDPOINTS

  @Post('momo-ipn') // Lưu ý MoMo gửi Webhook IPN qua POST
  @Public()
  @ApiOperation({ summary: 'Webhook xử lý kết quả thanh toán từ MoMo' })
  async momoIpn(@Body() body: Record<string, unknown>) {
    // Không cần gán vào biến ipnResult nếu không sử dụng
    await this.paymentService.handleIpn('MOMO', body);

    // Khác với VNPAY trả về RspCode, MoMo yêu cầu HTTP 204 (No Content) hoặc 200 OK rỗng
    return { status: 200, message: 'Đã nhận tín hiệu' };
  }

  @Get('momo-return')
  @Public()
  @ApiOperation({ summary: 'Xử lý redirect từ MoMo về Frontend' })
  async momoReturn(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const orderId = query.orderId as string;
      const resultCode = query.resultCode;

      // Xác thực lại tính toàn vẹn (Checksum)
      const isValid = await this.paymentService.verifyProviderReturnUrl(
        'MOMO',
        query,
      );

      if (isValid && String(resultCode) === '0') {
        return res.redirect(`${frontendUrl}/checkout/success?code=${orderId}`);
      } else {
        return res.redirect(
          `${frontendUrl}/checkout/fail?code=${orderId}&status=failed`,
        );
      }
    } catch (error) {
      console.error('MoMo Return Error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/checkout/fail?error=system_error`);
    }
  }

  @Post('repayment-link/:orderId')
  @Public()
  @ApiOperation({ summary: 'Lấy link thanh toán lại' })
  async getRepaymentLink(@Param('orderId') id: string, @Req() req: Request) {
    let ip = req.headers['x-forwarded-for'];

    if (Array.isArray(ip)) {
      ip = ip[0];
    }

    const cleanIp = (ip as string) || req.socket.remoteAddress || '127.0.0.1';
    const finalIp = cleanIp.split(',')[0].trim();

    return this.paymentService.getRepaymentLink(id, finalIp);
  }

  //API DÀNH CHO ADMIN

  @Patch('admin/configs/:provider')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.SYSTEM, Action.UPDATE) // Quyền cấu hình hệ thống
  @ApiOperation({
    summary: 'Admin cập nhật cấu hình cổng thanh toán (US1.AC1)',
  })
  async updateConfig(
    @Param('provider') provider: string,
    @Body() updateData: Partial<PaymentConfig>,
  ) {
    return this.paymentService.updatePaymentConfig(
      provider.toUpperCase(),
      updateData,
    );
  }

  @Post('admin/refund/:orderId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.UPDATE) // Quyền thao tác với đơn hàng
  @ApiOperation({ summary: 'Admin yêu cầu hoàn tiền cho đơn hàng (US2.AC4)' })
  async requestRefund(
    @Param('orderId') orderId: string,
    @Req() req: Request & { user?: { id: string } },
  ) {
    const adminId = req.user?.id || 'SYSTEM_ADMIN';
    return this.paymentService.processRefund(orderId, adminId);
  }
}
