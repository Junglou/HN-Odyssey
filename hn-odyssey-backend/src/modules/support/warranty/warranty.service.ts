import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  WarrantyItem,
  WarrantyClaim,
  WarrantyStatus,
  ClaimStatus,
} from './schemas/warranty-claim.schema';
import { BaseResponse } from 'src/common/dtos/base-response.dto';

@Injectable()
export class WarrantyService {
  constructor(
    @InjectModel(WarrantyItem.name) private itemModel: Model<WarrantyItem>,
    @InjectModel(WarrantyClaim.name) private claimModel: Model<WarrantyClaim>,
    private eventEmitter: EventEmitter2,
    @InjectConnection() private connection: Connection,
  ) {}

  //  Helper tính trạng thái tự động (AC1, AC3)
  private calculateStatus(
    endDate: Date,
    currentStatus: WarrantyStatus,
  ): WarrantyStatus {
    if (currentStatus === WarrantyStatus.VOIDED) return WarrantyStatus.VOIDED;

    const now = new Date();
    const daysLeft = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) return WarrantyStatus.EXPIRED; // Hết hạn
    if (daysLeft <= 30) return WarrantyStatus.EXPIRING_SOON; // Cảnh báo vàng
    return WarrantyStatus.ACTIVE; // Đang bảo hành
  }

  //  AC2: Guest Lookup (Bảo mật: Phải khớp Order & Phone)
  async guestLookup(orderCode: string, phone: string) {
    if (!orderCode || !phone)
      throw new BadRequestException('Vui lòng nhập đủ Mã đơn và SĐT');

    const items = await this.itemModel
      .find({ order_code: orderCode, customer_phone: phone })
      .lean();

    if (items.length === 0) {
      throw new BadRequestException('Không tìm thấy thông tin đơn hàng này'); // AC2 Validation
    }

    const mappedItems = items.map((item) => ({
      ...item,
      // Đã gỡ bỏ ép kiểu thừa vì item.status đã là WarrantyStatus
      dynamic_status: this.calculateStatus(item.end_date, item.status), // AC3
    }));

    return new BaseResponse(true, 'Tra cứu thành công', mappedItems);
  }

  //  AC4 & AC6: Tạo RMA Request
  async submitClaim(warrantyItemId: string, reason: string, images: string[]) {
    const item = await this.itemModel.findById(warrantyItemId);
    if (!item) throw new NotFoundException('Sản phẩm không tồn tại');

    // Đã gỡ bỏ ép kiểu thừa
    if (
      this.calculateStatus(item.end_date, item.status) ===
      WarrantyStatus.EXPIRED
    ) {
      throw new BadRequestException('Sản phẩm đã hết hạn bảo hành'); // Không cho tạo claim nếu hết hạn
    }

    const claim = await this.claimModel.create({
      claim_code: `RMA-W-${Date.now()}`,
      warranty_item_id: item._id,
      reason,
      images,
      timeline: [
        {
          status: ClaimStatus.SUBMITTED,
          note: 'Khách hàng gửi yêu cầu',
          timestamp: new Date(),
        },
      ],
    });

    // Bắn sự kiện gửi Email (AC5)
    this.eventEmitter.emit('notify.warranty.submitted', {
      claim_code: claim.claim_code,
      phone: item.customer_phone,
    });

    return new BaseResponse(
      true,
      'Yêu cầu đổi trả bảo hành đã được ghi nhận',
      claim,
    );
  }

  //  AC8, AC10: Admin Update & Đổi mới 1-1
  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus,
    note: string,
    isExchange: boolean,
  ) {
    const claim = await this.claimModel
      .findById(claimId)
      .populate('warranty_item_id');
    if (!claim) throw new NotFoundException('Không tìm thấy phiếu yêu cầu');

    const warrantyItem = claim.warranty_item_id as unknown as WarrantyItem;

    // TỐI ƯU 1: Khởi tạo Transaction Session
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      claim.status = status;
      claim.timeline.push({ status, note, timestamp: new Date() });
      await claim.save({ session }); // Lưu có session

      // KHI HOÀN TẤT & LÀ ĐỔI MỚI (AC10)
      if (status === ClaimStatus.COMPLETED && isExchange) {
        // 1. Hủy sổ bảo hành cũ
        warrantyItem.status = WarrantyStatus.VOIDED;
        warrantyItem.void_reason =
          'Đã đổi mới 1-1 theo yêu cầu: ' + claim.claim_code;
        await warrantyItem.save({ session }); // Lưu có session

        // 2. Tạo sổ bảo hành mới (Tính lại từ đầu - reset thời gian)
        const durationMs =
          warrantyItem.end_date.getTime() - warrantyItem.start_date.getTime();
        const newStartDate = new Date();
        const newEndDate = new Date(newStartDate.getTime() + durationMs);

        // Lưu ý: hàm create() truyền mảng object để sử dụng được option { session }
        await this.itemModel.create(
          [
            {
              order_id: warrantyItem.order_id,
              order_code: warrantyItem.order_code,
              customer_phone: warrantyItem.customer_phone,
              product_id: warrantyItem.product_id,
              product_name: `[Đổi Mới 1-1] ${warrantyItem.product_name}`,
              start_date: newStartDate,
              end_date: newEndDate,
              status: WarrantyStatus.ACTIVE,
            },
          ],
          { session }, // Ràng buộc vào Transaction
        );
      }

      // Xác nhận commit mọi thay đổi vào DB
      await session.commitTransaction();
    } catch {
      // Nếu có bất kỳ lỗi gì ở 3 hàm save/create trên, Rollback toàn bộ
      await session.abortTransaction();
      throw new BadRequestException(
        'Lỗi hệ thống khi xử lý đổi mới. Đã tự động Rollback dữ liệu.',
      );
    } finally {
      await session.endSession();
    }

    // Các event Notify gửi khách hàng diễn ra bên ngoài Transaction để tránh spam nếu roll-back
    if (status === ClaimStatus.COMPLETED) {
      this.eventEmitter.emit('notify.warranty.completed', {
        claim_code: claim.claim_code,
        message: 'Yêu cầu bảo hành đã hoàn tất. ' + note,
      });
    }

    return new BaseResponse(true, 'Cập nhật tiến độ thành công', claim);
  }
}
