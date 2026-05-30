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
      // FIX TẠI ĐÂY: Ưu tiên lấy status do FE truyền lên
      status: dto.status || CouponStatus.DRAFT,
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
    const now = new Date(); // Lấy mốc thời gian hiện tại lúc gọi API

    // Khởi tạo filter rỗng
    const filter: FilterQuery<Coupon> = {};

    // XỬ LÝ LỌC TRẠNG THÁI THÔNG MINH
    if (query.status === CouponStatus.CANCELLED) {
      filter.status = CouponStatus.CANCELLED;
      // Lọc Cancelled thì hiện cả mã đã xóa mềm
    } else {
      filter.is_deleted = false; // Mặc định giấu mã đã xóa

      if (query.status === CouponStatus.ACTIVE) {
        // ACTIVE thực sự = Trạng thái ACTIVE + Chưa hết hạn
        filter.status = CouponStatus.ACTIVE;
        filter.end_date = { $gte: now };
      } else if (query.status === CouponStatus.INACTIVE) {
        // INACTIVE = Trạng thái INACTIVE HOẶC (Trạng thái ACTIVE nhưng đã quá hạn)
        filter.$or = [
          { status: CouponStatus.INACTIVE },
          { status: CouponStatus.ACTIVE, end_date: { $lt: now } },
        ];
      } else if (query.status) {
        // Lọc Draft
        filter.status = query.status;
      }
    }

    // Lọc theo từ khóa (Tìm chuỗi con, Regex)
    if (query.search && typeof query.search === 'string') {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.code = { $regex: searchRegex };
    }

    const [rawData, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.couponModel.countDocuments(filter),
    ]);

    // COMPUTED DATA: Biến đổi dữ liệu trước khi trả về FE
    const formattedData = rawData.map((coupon) => {
      // Nếu Database báo là ACTIVE nhưng thực tế đã hết hạn -> Trả về FE là INACTIVE
      if (
        coupon.status === CouponStatus.ACTIVE &&
        new Date(coupon.end_date) < now
      ) {
        coupon.status = CouponStatus.INACTIVE;
      }
      return coupon;
    });

    return {
      data: formattedData,
      meta: {
        totalItems: total,
        itemCount: formattedData.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // API dành cho Frontend: Lấy danh sách các mã giảm giá đang có hiệu lực
  async findActiveCoupons() {
    const now = new Date();
    const activeCoupons = await this.couponModel
      .find({
        is_deleted: false,
        status: CouponStatus.ACTIVE,
        start_date: { $lte: now },
        end_date: { $gte: now },
        // Chỉ lấy những mã mà số lần đã dùng vẫn còn nhỏ hơn giới hạn sử dụng
        $expr: { $lt: ['$usage_count', '$usage_limit'] },
      })
      .select(
        'code discount_type discount_value min_order_value usage_count usage_limit start_date end_date',
      )
      .lean()
      .exec();

    return activeCoupons;
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
      voucher_code: code.toUpperCase(),
      status: { $nin: ['CANCELLED', 'TEMPORARY'] },
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
    coupon.status = CouponStatus.CANCELLED;
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

  private validateDates(start: string, end: string) {
    if (new Date(end) <= new Date(start)) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn ngày bắt đầu');
    }
  }

  // Bổ sung: Bulk update status
  async bulkUpdateStatus(
    ids: string[],
    action: 'ACTIVATE' | 'DEACTIVATE',
    userId?: string,
  ) {
    const status =
      action === 'ACTIVATE' ? CouponStatus.ACTIVE : CouponStatus.INACTIVE;

    await this.couponModel.updateMany(
      { _id: { $in: ids }, is_deleted: false },
      { $set: { status } },
    );

    await this.auditLogsService.log({
      action: 'BULK_UPDATE_COUPON_STATUS',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: 'BULK',
      department: Department.MARKETING,
      detail: { ids, new_status: status },
      is_success: true,
    });
  }

  // Bổ sung: Bulk delete
  async bulkDelete(ids: string[], userId?: string) {
    await this.couponModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          status: CouponStatus.CANCELLED,
        },
      },
    );

    await this.auditLogsService.log({
      action: 'BULK_DELETE_COUPONS',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: 'BULK',
      department: Department.MARKETING,
      detail: { deleted_ids: ids },
      is_success: true,
    });
  }
}
