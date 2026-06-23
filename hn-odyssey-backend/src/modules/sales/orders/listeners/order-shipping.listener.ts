import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
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
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';

@Injectable()
export class OrderShippingListener {
  private readonly logger = new Logger(OrderShippingListener.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ghnService: GhnService,
    private readonly ghtkService: GhtkService,
    private readonly shippingService: ShippingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('order.ready_to_ship', { async: true })
  async handleReadyToShip(orderPlain: OrderData & { internal_note?: string }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const config =
        (await this.shippingService.getDefaultConfig()) as unknown as {
          default_provider?: string;
          box_length?: number;
          box_width?: number;
          box_height?: number;
        };

      const sInfo = orderPlain.shipping_info;

      const shippingItems = (orderPlain.items || []).map((item: OrderItem) => ({
        name: String(item.product_name),
        code: String(item.sku),
        quantity: Number(item.quantity),
        price: Number(item.price),
        weight: Number(item.weight ?? 0.5),
      }));

      const totalWeightKg = shippingItems.reduce(
        (sum, i) => sum + i.weight * i.quantity,
        0,
      );

      const unitMapping = await this.shippingService.getMappingCode(
        String(sInfo.district_code),
      );

      const wardMapping = await this.shippingService.getMappingCode(
        String(sInfo.ward_code),
      );

      const mappedDistrictId = Number(
        unitMapping?.mapping?.ghn_id || sInfo.district_code,
      );
      const mappedWardCode = String(
        wardMapping?.mapping?.ghn_ward_code || sInfo.ward_code || '',
      );

      // Đẩy toàn bộ đơn hàng sang hệ thống của ghn
      const shippingResult = await this.ghnService.createShippingOrder({
        customerName: String(sInfo.name),
        phone: String(sInfo.phone),
        address: String(sInfo.address),
        codAmount:
          orderPlain.payment?.method === 'COD'
            ? Number(orderPlain.total_amount)
            : 0,
        weight: totalWeightKg,
        wardCode: mappedWardCode,
        districtId: mappedDistrictId,
        note: String(orderPlain.internal_note || 'H&N Odyssey Order'),
        items: shippingItems.map((i) => ({
          ...i,
          weight: Math.ceil(i.weight * 1000),
        })),
      });

      await this.orderModel.findByIdAndUpdate(orderPlain._id, {
        $set: {
          waybill_code: shippingResult.waybillCode,
          actual_shipping_fee: shippingResult.actualFee,
        },
      });

      this.logger.log(
        `Tạo vận đơn thành công cho đơn ${orderPlain.order_code} qua GHN`,
      );
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Lỗi ĐVVC không xác định';
      this.logger.error(
        `Lỗi tạo vận đơn cho đơn ${orderPlain.order_code}: ${errorMsg}`,
      );

      await this.orderModel.findByIdAndUpdate(orderPlain._id, {
        $set: {
          status: OrderStatus.CONFIRMED,
          internal_note: `[LỖI VẬN CHUYỂN ${new Date().toLocaleString()}]: ${errorMsg}. Vui lòng thử lại.`,
        },
      });

      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'HIGH',
        error_code: `SHIPPING_API_ERROR`,
        message: `Mất kết nối hoặc lỗi API từ ĐVVC khi tạo vận đơn cho đơn ${orderPlain.order_code}. Chi tiết: ${errorMsg}`,
        stack_trace: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  @OnEvent('order.cancelled_shipping', { async: true })
  async handleCancelShipping(orderPlain: OrderData) {
    try {
      if (orderPlain.waybill_code) {
        // Chỉ gửi yêu cầu hủy vận đơn qua ghn
        await this.ghnService.cancelOrder(orderPlain.waybill_code);
        this.logger.log(
          `Đã hủy vận đơn ${orderPlain.waybill_code} trên hệ thống GHN`,
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không thể hủy vận đơn ${orderPlain.waybill_code} trên GHN: ${errMsg}`,
      );
      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'MEDIUM',
        error_code: `SHIPPING_CANCEL_ERROR`,
        message: `Lỗi API khi yêu cầu ĐVVC (GHN) hủy vận đơn ${orderPlain.waybill_code}. Chi tiết: ${errMsg}`,
      });
    }
  }

  // Lắng nghe lệnh tạo đơn GHN chiều thu hồi hàng (Refund)
  @OnEvent('order.refund_shipping_needed', { async: true })
  async handleRefundShipping(
    orderPlain: OrderData & { internal_note?: string },
  ) {
    try {
      const sInfo = orderPlain.shipping_info;
      if (!sInfo) return;

      const shippingItems = (orderPlain.items || []).map((item: OrderItem) => ({
        name: String(item.product_name),
        code: String(item.sku),
        quantity: Number(item.quantity),
        price: Number(item.price),
        weight: Number(item.weight ?? 0.5),
      }));

      const totalWeightKg = shippingItems.reduce(
        (sum, i) => sum + i.weight * i.quantity,
        0,
      );

      const unitMapping = await this.shippingService.getMappingCode(
        String(sInfo.district_code),
      );

      const wardMapping = await this.shippingService.getMappingCode(
        String(sInfo.ward_code),
      );

      const mappedDistrictId = Number(
        unitMapping?.mapping?.ghn_id || sInfo.district_code,
      );
      const mappedWardCode = String(
        wardMapping?.mapping?.ghn_ward_code || sInfo.ward_code || '',
      );

      // Kích hoạt tham số isReverse: true để GHN tự đổi vai trò (Customer là người gửi, Shop là người nhận)
      const shippingResult = await this.ghnService.createShippingOrder({
        customerName: String(sInfo.name),
        phone: String(sInfo.phone),
        address: String(sInfo.address),
        codAmount: 0, // Đơn hoàn trả không thu hộ (COD = 0)
        weight: totalWeightKg,
        wardCode: mappedWardCode,
        districtId: mappedDistrictId,
        note: String(`Hoàn trả hàng cho đơn ${orderPlain.order_code}`),
        isReverse: true, // [RẤT QUAN TRỌNG]: Tái sử dụng thiết kế cấu hình điểm A/B của Trade-in
        items: shippingItems.map((i) => ({
          ...i,
          weight: Math.ceil(i.weight * 1000), // Đổi sang gram cho GHN
        })),
      });

      // Tối ưu Backend: Dùng UpdateOne thay thế save()
      await this.orderModel.updateOne(
        { _id: orderPlain._id },
        {
          $set: {
            waybill_code: shippingResult.waybillCode,
            actual_shipping_fee: shippingResult.actualFee,
            internal_note:
              `[GHN REFUND]: Đã tự động tạo mã vận đơn lấy hàng: ${shippingResult.waybillCode}. ` +
              (orderPlain.internal_note || ''),
          },
        },
      );

      this.logger.log(
        `Tạo vận đơn REFUND thành công cho đơn ${orderPlain.order_code} qua GHN`,
      );
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Lỗi ĐVVC không xác định';
      this.logger.error(
        `Lỗi tạo vận đơn hoàn hàng cho đơn ${orderPlain.order_code}: ${errorMsg}`,
      );

      await this.orderModel.updateOne(
        { _id: orderPlain._id },
        {
          $set: {
            internal_note:
              `[LỖI VẬN CHUYỂN HOÀN HÀNG]: ${errorMsg}. Vui lòng xử lý thủ công. ` +
              (orderPlain.internal_note || ''),
          },
        },
      );

      this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
        severity: 'HIGH',
        error_code: `SHIPPING_API_ERROR`,
        message: `Lỗi tạo đơn hoàn hàng qua GHN (Refund) cho đơn ${orderPlain.order_code}. Chi tiết: ${errorMsg}`,
      });
    }
  }
}
