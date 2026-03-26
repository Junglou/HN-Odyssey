import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Coupon, CouponStatus, DiscountType } from './schemas/coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';

export interface QueryCouponDto {
  page?: number | string;
  limit?: number | string;
  status?: CouponStatus;
  search?: string;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel('Order') private orderModel: Model<Order>,
  ) {}

  // AC1, AC2, AC3, AC4: Tạo mã giảm giá mới
  async createCoupon(dto: CreateCouponDto, userId?: string) {
    // Kiểm tra trùng lặp mã (AC2) - Bất kể is_deleted
    const existingCoupon = await this.couponModel.findOne({
      code: dto.code.toUpperCase(),
    });
    if (existingCoupon) {
      throw new BadRequestException('Mã giảm giá đã tồn tại trong hệ thống.');
    }

    this.validateCouponLogic(
      dto.discount_type,
      dto.discount_value,
      dto.min_order_value,
    );
    this.validateDates(dto.start_date, dto.end_date);

    const newCoupon = new this.couponModel({
      ...dto,
      code: dto.code.toUpperCase(),
      status: CouponStatus.DRAFT,
    });

    const savedCoupon = await newCoupon.save();

    await this.auditLogsService.log({
      action: 'CREATE_COUPON',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: savedCoupon._id,
      department: Department.MARKETING,
      detail: { code: savedCoupon.code },
      is_success: true,
    });

    return savedCoupon;
  }

  // Lấy danh sách (Có phân trang và lọc) dành cho Admin
  async findAll(query: QueryCouponDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    // Khai báo kiểu FilterQuery chuẩn của Mongoose
    const filter: FilterQuery<Coupon> = { is_deleted: false };

    if (query.status) {
      filter.status = query.status;
    }

    // Kiểm tra an toàn trước khi gọi toUpperCase
    if (query.search && typeof query.search === 'string') {
      filter.code = query.search.toUpperCase().trim();
    }

    const [data, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.couponModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // Lấy chi tiết 1 mã
  async findOne(id: string) {
    const coupon = await this.couponModel
      .findOne({ _id: id, is_deleted: false })
      .lean();
    if (!coupon) throw new NotFoundException('Không tìm thấy mã giảm giá');
    return coupon;
  }

  // API Cực kỳ quan trọng: Áp dụng mã khi khách hàng Checkout
  async applyCoupon(code: string, cartTotal: number, userId: string) {
    const coupon = await this.couponModel.findOne({
      code: code.toUpperCase(),
      is_deleted: false,
    });

    if (!coupon) {
      throw new BadRequestException('Mã giảm giá không tồn tại.');
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException(
        'Mã giảm giá chưa được kích hoạt hoặc đã tạm dừng.',
      );
    }

    const now = new Date();
    if (now < coupon.start_date || now > coupon.end_date) {
      throw new BadRequestException(
        'Mã giảm giá không trong thời gian hiệu lực.',
      );
    }

    if (coupon.usage_count >= coupon.usage_limit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng.');
    }

    if (cartTotal < coupon.min_order_value) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu để áp dụng mã này là ${coupon.min_order_value}đ.`,
      );
    }

    const userUsedCount = await this.orderModel.countDocuments({
      user_id: userId,
      voucher_code: code.toUpperCase(), // Sửa thành voucher_code và cho UpperCase để chuẩn xác
      status: { $nin: ['CANCELLED', 'TEMPORARY'] }, // Phải loại trừ đơn hủy và đơn tạm (chưa thanh toán)
    });
    if (userUsedCount >= coupon.user_usage_limit)
      throw new BadRequestException('Bạn đã hết lượt sử dụng mã này.');

    let discountAmount = 0;
    if (coupon.discount_type === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((cartTotal * coupon.discount_value) / 100);
      if (
        coupon.max_discount_amount &&
        discountAmount > coupon.max_discount_amount
      ) {
        discountAmount = coupon.max_discount_amount;
      }
    } else {
      discountAmount = coupon.discount_value;
    }

    return {
      code: coupon.code,
      discount_amount: discountAmount,
      final_total:
        cartTotal - discountAmount > 0 ? cartTotal - discountAmount : 0,
    };
  }

  // AC6, AC7: Chỉnh sửa mã giảm giá
  async updateCoupon(id: string, dto: UpdateCouponDto, userId?: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.is_deleted) {
      throw new NotFoundException('Không tìm thấy mã giảm giá');
    }

    // Nếu đang chạy (ACTIVE), cấm sửa giá trị và điều kiện (AC7)
    if (coupon.status === CouponStatus.ACTIVE && coupon.usage_count > 0) {
      const forbiddenFields = [
        'discount_type',
        'discount_value',
        'min_order_value',
        'usage_limit',
      ];
      const attemptToEditForbidden = forbiddenFields.some((field) =>
        Object.keys(dto).includes(field),
      );

      if (attemptToEditForbidden) {
        throw new BadRequestException(
          'Mã đang kích hoạt và đã có lượt sử dụng, chỉ được phép sửa Thời gian hiệu lực và Trạng thái.',
        );
      }
    }

    if (dto.start_date || dto.end_date) {
      const start = dto.start_date || coupon.start_date.toISOString();
      const end = dto.end_date || coupon.end_date.toISOString();
      this.validateDates(start, end);
    }

    if (dto.discount_type || dto.discount_value || dto.min_order_value) {
      const type = dto.discount_type || coupon.discount_type;
      const value = dto.discount_value ?? coupon.discount_value;
      const minOrder = dto.min_order_value ?? coupon.min_order_value;
      this.validateCouponLogic(type, value, minOrder);
    }

    Object.assign(coupon, dto);

    if (!coupon.status) {
      coupon.status = CouponStatus.DRAFT;
    }

    const updatedCoupon = await coupon.save();

    await this.auditLogsService.log({
      action: 'UPDATE_COUPON',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: updatedCoupon._id,
      department: Department.MARKETING,
      detail: { updated_fields: Object.keys(dto) },
      is_success: true,
    });

    return updatedCoupon;
  }

  // AC8: Vô hiệu hóa / Xóa mềm
  async softDeleteCoupon(id: string, userId?: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.is_deleted) {
      throw new NotFoundException('Không tìm thấy mã giảm giá');
    }

    coupon.is_deleted = true;
    coupon.deleted_at = new Date();
    coupon.status = CouponStatus.CANCELLED; // Chuyển sang đã hủy
    await coupon.save();

    await this.auditLogsService.log({
      action: 'SOFT_DELETE_COUPON',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: coupon._id,
      department: Department.MARKETING,
      detail: { code: coupon.code },
      is_success: true,
    });

    return { message: 'Xóa mã giảm giá thành công' };
  }

  // Hàm Utils kiểm tra Logic (AC3)
  private validateCouponLogic(
    type: DiscountType,
    value: number,
    minOrder?: number,
  ) {
    if (type === DiscountType.PERCENTAGE && value > 100) {
      throw new BadRequestException(
        'Giá trị phần trăm không được vượt quá 100%',
      );
    }
    if (type === DiscountType.FIXED_AMOUNT && minOrder && value > minOrder) {
      throw new BadRequestException(
        'Giá trị giảm không được lớn hơn Đơn hàng tối thiểu',
      );
    }
  }

  // Hàm Utils kiểm tra Thời gian (AC4)
  private validateDates(start: string, end: string) {
    if (new Date(end) <= new Date(start)) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn ngày bắt đầu');
    }
  }
}
