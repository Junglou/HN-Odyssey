import { Injectable, BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  MongooseOrderDoc,
  STATUS_RANK,
} from 'src/common/interfaces/order.interface';

@Injectable()
export class OrderStateMachine {
  // 1. Cấu hình các bước chuyển trạng thái hợp lệ (Whitelisting) chuẩn E-commerce
  private readonly transitions: Record<string, OrderStatus[]> = {
    [OrderStatus.TEMPORARY]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
    [OrderStatus.PENDING]: [
      OrderStatus.PRIORITY,
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
      OrderStatus.TRADE_IN_REVIEW,
    ],
    [OrderStatus.TRADE_IN_REVIEW]: [
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PRIORITY]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [
      OrderStatus.PROCESSING,
      OrderStatus.ON_HOLD,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.ON_HOLD]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],

    [OrderStatus.PROCESSING]: [
      OrderStatus.READY_TO_SHIP,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPING]: [
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERY_FAILED,
      OrderStatus.RETURNED,
    ],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
    [OrderStatus.REFUND_NEEDED]: [
      OrderStatus.REFUNDED,
      OrderStatus.CANCELLED, // Admin có thể hủy hẳn sau khi xử lý thủ công
    ],
    [OrderStatus.DELIVERY_FAILED]: [
      OrderStatus.SHIPPING,
      OrderStatus.RETURNED,
      OrderStatus.CANCELLED,
    ],

    // Luồng hoàn tiền (QUAN TRỌNG)
    [OrderStatus.REFUND_PENDING]: [OrderStatus.REFUNDED, OrderStatus.CANCELLED],
    [OrderStatus.CANCELLED]: [OrderStatus.PENDING], // Cho phép Admin khôi phục đơn nếu Override

    // Trạng thái cuối
    [OrderStatus.RETURNED]: [],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.REFUNDED]: [],
  };

  async validateTransition(
    order: MongooseOrderDoc,
    nextStatus: OrderStatus,
    isOverride: boolean,
    reason?: string,
  ) {
    const currentStatus = order.status as OrderStatus;

    // 1. CHẶN GHI ĐÈ NẾU KHÔNG CÓ LÝ DO (US.123 - AC4)
    if (isOverride) {
      if (!reason || reason.trim() === '') {
        throw new BadRequestException(
          'Hành động ghi đè trạng thái bắt buộc phải nhập lý do (reason).',
        );
      }
      return true; // Nếu có lý do hợp lệ, cho phép bypass mọi rule bên dưới
    }

    // 2. CHỐNG LÙI TRẠNG THÁI (Regression Guard)
    const currentRank = STATUS_RANK[currentStatus] || 0;
    const nextRank = STATUS_RANK[nextStatus] || 0;

    if (nextStatus !== OrderStatus.CANCELLED && nextRank < currentRank) {
      throw new BadRequestException(
        `Không thể lùi trạng thái từ [${currentStatus}] về [${nextStatus}]`,
      );
    }

    // 3. KIỂM TRA TRONG BẢNG CHUYỂN ĐỔI HỢP LỆ
    const allowed = this.transitions[currentStatus];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Quy trình không hợp lệ: Không thể chuyển từ [${currentStatus}] sang [${nextStatus}]`,
      );
    }

    // 4. Chạy các Guard Checks (Ràng buộc dữ liệu nghiêm ngặt)
    await this.runGuards(order, nextStatus);

    return true;
  }

  // Các quy tắc bảo vệ trạng thái (Guards)
  // 1. Cập nhật Guards
  private async runGuards(order: MongooseOrderDoc, nextStatus: OrderStatus) {
    const currentStatus = order.status as OrderStatus;

    switch (nextStatus) {
      case OrderStatus.TRADE_IN_REVIEW:
        // [FIX]: Kiểm tra thực tế xem đơn có item trade-in không (Giả sử bạn có flag is_trade_in)
        // if (!order.is_trade_in) throw new BadRequestException('Đơn hàng không có sản phẩm thu cũ đổi mới.');
        break;

      case OrderStatus.CANCELLED:
        // CHẶN: Đã hoàn thành thì không được hủy, chỉ được trả hàng (RETURNED)
        if (currentStatus === OrderStatus.COMPLETED) {
          throw new BadRequestException(
            'Đơn hàng đã hoàn thành, không thể hủy. Vui lòng sử dụng luồng Trả hàng.',
          );
        }
        break;

      case OrderStatus.COMPLETED:
        // [FIX]: Ràng buộc: Phải giao thành công (DELIVERED) mới được Hoàn thành
        if (currentStatus !== OrderStatus.DELIVERED) {
          throw new BadRequestException(
            `Không thể hoàn thành đơn hàng khi đang ở trạng thái [${currentStatus}]. Đơn hàng cần được giao thành công trước.`,
          );
        }
        if (order.payment.status !== 'PAID') {
          throw new BadRequestException(
            'Đơn hàng chưa được ghi nhận thanh toán.',
          );
        }
        break;

      case OrderStatus.SHIPPING:
        // Chặn trường hợp đơn Trade-In chưa được kiểm định mà đã đòi đi giao
        if (currentStatus === OrderStatus.TRADE_IN_REVIEW) {
          throw new BadRequestException(
            'Thiết bị cũ chưa được kiểm định xong, không thể xuất kho giao hàng.',
          );
        }
        break;
    }
  }

  // Hàm thực thi cập nhật Timeline thống nhất
  addTimeline(
    order: MongooseOrderDoc,
    status: OrderStatus,
    actor: string,
    note?: string,
  ) {
    order.timeline.push({
      status: status,
      timestamp: new Date(),
      actor: actor,
      note: note || `Trạng thái được cập nhật thành ${status}`,
    });
  }
}
