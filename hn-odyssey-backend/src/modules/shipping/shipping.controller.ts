import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Logger,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { Public } from 'src/common/decorators/public.decorator';
import { CalculateShippingFeeDto } from './dto/calculate-fee.dto';
import { CartItem, OrderItem } from 'src/common/interfaces/order.interface';
import { GhnService } from './providers/ghn.service';
import { OrdersService } from '../sales/orders/orders.service';
import {
  GHN_INTERNAL_MAP,
  GHTK_INTERNAL_MAP,
} from 'src/common/constants/shipping.constant';
import { GhtkService } from './providers/ghtk.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

interface IGhnWebhookPayload {
  OrderCode: string;
  Status: string;
}

interface IOrderWithWaybill {
  waybill_code: string;
}

interface IGhtkWebhookPayload {
  label_id: string; // Mã vận đơn (Waybill code)
  partner_id: string; // Mã đơn hàng nội bộ của bạn (Order code)
  status_id: number; // Mã trạng thái của GHTK (Dạng số)
  action_time: string;
  reason_code: string;
  reason: string;
  weight: number;
  fee: number;
}

@ApiTags('Shipping (Vận chuyển)')
@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly shippingService: ShippingService,
    private readonly ghnService: GhnService,
    private readonly ordersService: OrdersService,
    private readonly ghtkService: GhtkService,
  ) {}

  @Post('calculate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tính phí vận chuyển (Ước tính)' })
  @ApiResponse({ status: 200, description: 'Phí ship dự kiến (VNĐ)' })
  async calculateFee(@Body() dto: CalculateShippingFeeDto) {
    const fee = await this.shippingService.calculateShippingFee(
      dto.cityCode,
      dto.districtCode,
      dto.items as (CartItem | OrderItem)[],
      dto.isInstant,
    );

    return { shipping_fee: fee, currency: 'VND' };
  }

  // AC3: Cập nhật trạng thái tự động qua Webhook GHN
  @Post('webhook/ghn')
  @Public()
  async handleGhnWebhook(@Body() payload: IGhnWebhookPayload) {
    const { OrderCode, Status } = payload;

    const statusKey = (Status || '').toLowerCase();
    const internalStatus = GHN_INTERNAL_MAP[statusKey];

    // 3. Xóa bỏ 'as OrderStatus' vì GHN_INTERNAL_MAP đã được định nghĩa kiểu OrderStatus
    if (internalStatus) {
      await this.ordersService.updateStatusByWaybill(OrderCode, internalStatus);
    } else {
      this.logger.error(
        `Trạng thái không hợp lệ nhận được từ ĐVVC: ${statusKey}`,
      );
    }

    return { success: true };
  }

  @Post('webhook/ghtk')
  @Public() // Đảm bảo GHTK có thể gọi vào API này không bị chặn bởi JWT Token
  async handleGhtkWebhook(@Body() payload: IGhtkWebhookPayload) {
    const { label_id, status_id } = payload;

    // GHTK trả status_id là số (VD: 2, 3, 4, 45), cần ép kiểu sang chuỗi để map với GHTK_INTERNAL_MAP
    const statusKey = String(status_id);
    const internalStatus = GHTK_INTERNAL_MAP[statusKey];

    if (internalStatus) {
      await this.ordersService.updateStatusByWaybill(
        label_id, // Truyền mã vận đơn để tìm đúng đơn hàng
        internalStatus,
      );
      this.logger.log(
        `[Webhook GHTK] Đã cập nhật đơn ${label_id} -> ${internalStatus}`,
      );
    } else {
      this.logger.error(
        `[Webhook GHTK] Trạng thái không hợp lệ hoặc không cần xử lý: ${statusKey}`,
      );
    }

    // GHTK yêu cầu trả về HTTP Status 200 kèm JSON có thuộc tính success: true
    return { success: true };
  }

  @Get('sync/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Resource.ORDERS, Action.UPDATE)
  @ApiOperation({ summary: 'Đồng bộ trạng thái thủ công từ ĐVVC' })
  async manualSync(@Param('orderId') orderId: string, @Req() req: Request) {
    const orderRaw = await this.ordersService.findOne(orderId);
    const order = orderRaw as unknown as IOrderWithWaybill & {
      shipping_info?: { provider?: string };
    };

    const provider = (order.shipping_info?.provider || 'GHN').toUpperCase();
    let statusKey = '';
    let internalStatus: string | undefined;

    if (provider === 'GHTK') {
      const latestInfo = (await this.ghtkService.getOrderInfo(
        order.waybill_code,
      )) as {
        order?: { status?: string | number };
      };
      statusKey = latestInfo?.order?.status?.toString() || '';
      internalStatus = GHTK_INTERNAL_MAP[statusKey];
    } else {
      const latestInfo = (await this.ghnService.getOrderInfo(
        order.waybill_code,
      )) as { status: string };
      statusKey = (latestInfo?.status || '').toLowerCase();
      internalStatus = GHN_INTERNAL_MAP[statusKey];
    }

    if (internalStatus) {
      return this.ordersService.updateStatusAdvanced(
        orderId,
        { status: internalStatus, reason: `Đồng bộ thủ công từ ${provider}` },
        'SYSTEM_SYNC',
        `${provider}_SYSTEM`,
        req.ip ?? '127.0.0.1',
        req.headers['user-agent'] ?? 'System-Sync',
      );
    }

    return { message: 'Trạng thái đã mới nhất' };
  }

  @Get('print-label/:waybillCode')
  @ApiOperation({ summary: 'Lấy link in vận đơn' })
  async printLabel(@Param('waybillCode') waybillCode: string) {
    return { url: await this.ghnService.getPrintLabel(waybillCode) };
  }

  @Get('locations/provinces')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách Tỉnh/Thành phố' })
  async getProvinces() {
    return this.shippingService.getProvinces();
  }

  @Get('locations/districts/:provinceCode')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách Quận/Huyện theo Tỉnh/Thành phố' })
  async getDistricts(@Param('provinceCode') provinceCode: string) {
    return this.shippingService.getDistricts(provinceCode);
  }

  @Get('locations/wards/:districtCode')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách Phường/Xã theo Quận/Huyện' })
  async getWards(@Param('districtCode') districtCode: string) {
    return this.shippingService.getWards(districtCode);
  }

  @Post('seed-locations')
  @Public() // Đặt public để bạn test luôn, sau khi chạy xong nhớ XÓA API này đi cho an toàn
  @ApiOperation({ summary: 'Seeder: Đồng bộ dữ liệu Tỉnh/Huyện/Xã từ GHN' })
  async seedLocations() {
    // Chạy ngầm để không bị timeout (tác vụ mất khoảng 20-40 giây)
    await this.shippingService.seedGhnLocations();
    return {
      success: true,
      message:
        'Tiến trình đồng bộ đã được kích hoạt chạy ngầm. Vui lòng kiểm tra log Terminal của NestJS để xem tiến độ.',
    };
  }
}
