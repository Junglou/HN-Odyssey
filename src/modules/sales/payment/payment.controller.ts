import { Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Public } from 'src/common/decorators/public.decorator'; // Đảm bảo bạn có decorator này
import { ApiOperation } from '@nestjs/swagger';
import type { VnpayReturnParams } from 'src/common/interfaces/oder.interface';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('vnpay-ipn')
  @Public()
  @ApiOperation({ summary: 'Webhook xử lý kết quả thanh toán từ VNPAY' })
  async vnpayIpn(@Query() query: VnpayReturnParams) {
    return this.paymentService.handleVnpayIpn(query);
  }

  // Chuyển từ OrdersController sang
  @Post('repayment-link/:orderId') // Sửa lại route cho chuẩn RESTful
  @Public()
  @ApiOperation({ summary: 'Lấy link thanh toán lại' })
  async getRepaymentLink(@Param('orderId') id: string, @Ip() ip: string) {
    // Lưu ý: Logic getRepaymentLink nên chuyển từ OrdersService sang PaymentService
    return this.paymentService.getRepaymentLink(id, ip);
  }

  //API lấy danh sách các phương thức thanh toán đang hỗ trợ
  @Public()
  @Get('methods')
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
        // Sau này thêm Momo vào đây
        {
          code: 'MOMO',
          name: 'Ví điện tử MoMo',
          icon: 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
          is_active: false, // Tạm tắt
        },
      ],
    };
  }
}
