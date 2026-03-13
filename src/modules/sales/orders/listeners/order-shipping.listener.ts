import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { GhnService } from 'src/modules/shipping/providers/ghn.service';
import { GhtkService } from 'src/modules/shipping/providers/ghtk.service';
import { ShippingService } from 'src/modules/shipping/shipping.service';
import {
  OrderStatus,
  type OrderData,
  type OrderItem,
} from 'src/common/interfaces/order.interface';

@Injectable()
export class OrderShippingListener {
  private readonly logger = new Logger(OrderShippingListener.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ghnService: GhnService,
    private readonly ghtkService: GhtkService,
    private readonly shippingService: ShippingService,
  ) {}

  @OnEvent('order.ready_to_ship', { async: true })
  async handleReadyToShip(orderPlain: OrderData & { internal_note?: string }) {
    try {
      // 1. Dùng kiểu ShippingConfig thay vì any
      const config = await this.shippingService.getDefaultConfig();

      // 2. Ép kiểu rõ ràng là string để ESLint không báo "unsafe"
      const provider = (
        orderPlain.shipping_info?.provider ||
        config?.default_provider ||
        'GHN'
      ).toUpperCase();

      const sInfo = orderPlain.shipping_info;

      const shippingItems = (orderPlain.items || []).map((item: OrderItem) => ({
        name: item.product_name,
        code: item.sku,
        quantity: item.quantity,
        price: item.price,
        weight: item.weight ?? 0.5,
      }));

      const totalWeightKg = shippingItems.reduce(
        (sum, i) => sum + i.weight * i.quantity,
        0,
      );

      const unitMapping = await this.shippingService.getMappingCode(
        String(sInfo.district_code),
      );

      // Lấy mapping cho Phường (Thêm mới đoạn này)
      const wardMapping = await this.shippingService.getMappingCode(
        String(sInfo.ward_code),
      );

      let shippingResult: { waybillCode: string; actualFee: number };

      if (provider === 'GHTK') {
        const cityMapping = await this.shippingService.getMappingCode(
          String(sInfo.city_code),
        );
        shippingResult = await this.ghtkService.createShippingOrder({
          orderCode: orderPlain.order_code,
          customerName: sInfo.name,
          phone: sInfo.phone,
          address: sInfo.address,
          city: cityMapping?.mapping?.ghtk_name || sInfo.city || '',
          district: sInfo.district || unitMapping?.name_with_type || '',
          ward: sInfo.ward || '',
          codAmount:
            orderPlain.payment?.method === 'COD' ? orderPlain.total_amount : 0,
          totalValue: orderPlain.total_amount,
          items: shippingItems,
        });
      } else {
        const ghnDistrictId =
          unitMapping?.mapping?.ghn_id || Number(sInfo.district_code);

        // Ưu tiên lấy ghn_ward_code từ DB, nếu không có thì dùng fallback
        const ghnWardCode =
          wardMapping?.mapping?.ghn_ward_code || String(sInfo.ward_code || '');

        shippingResult = await this.ghnService.createShippingOrder({
          customerName: sInfo.name,
          phone: sInfo.phone,
          address: sInfo.address,
          codAmount:
            orderPlain.payment?.method === 'COD' ? orderPlain.total_amount : 0,
          weight: totalWeightKg,
          wardCode: ghnWardCode,
          districtId: ghnDistrictId,
          note: orderPlain.internal_note || 'H&N Odyssey Order',
          items: shippingItems.map((i) => ({
            ...i,
            weight: Math.ceil(i.weight * 1000), // Convert to gram
          })),
        });
      }

      await this.orderModel.findByIdAndUpdate(orderPlain._id, {
        $set: {
          waybill_code: shippingResult.waybillCode,
          actual_shipping_fee: shippingResult.actualFee,
        },
      });

      this.logger.log(
        `Tạo vận đơn thành công cho đơn ${orderPlain.order_code} qua ${provider}`,
      );
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Lỗi ĐVVC không xác định';
      this.logger.error(
        `Lỗi tạo vận đơn cho đơn ${orderPlain.order_code}: ${errorMsg}`,
      );

      await this.orderModel.findByIdAndUpdate(orderPlain._id, {
        $set: {
          // Đánh dấu để Admin lọc ra các đơn lỗi vận đơn
          status: OrderStatus.CONFIRMED, // Đẩy ngược về Confirmed để Staff có thể bấm "Giao hàng" lại
          internal_note: `[LỖI VẬN CHUYỂN ${new Date().toLocaleString()}]: ${errorMsg}. Vui lòng thử lại.`,
        },
      });
    }
  }

  @OnEvent('order.cancelled_shipping', { async: true })
  async handleCancelShipping(orderPlain: OrderData) {
    const provider = (
      orderPlain.shipping_info?.provider || 'GHN'
    ).toUpperCase();

    try {
      if (orderPlain.waybill_code) {
        if (provider === 'GHTK') {
          await this.ghtkService.cancelOrder(orderPlain.waybill_code);
        } else {
          await this.ghnService.cancelOrder(orderPlain.waybill_code);
        }
        this.logger.log(
          `Đã hủy vận đơn ${orderPlain.waybill_code} trên hệ thống ${provider}`,
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không thể hủy vận đơn ${orderPlain.waybill_code} trên ${provider}: ${errMsg}`,
      );
    }
  }
}
