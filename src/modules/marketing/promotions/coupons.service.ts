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

const ONGOING_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPING',
  'ON_HOLD',
  'TRADE_IN_REVIEW',
  'REFUND_PENDING',
  'REFUND_NEEDED',
];

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel('Order') private orderModel: Model<Order>,
  ) {}

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

  async findAll(query: QueryCouponDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;
    const now = new Date();

    const filter: FilterQuery<Coupon> = {};

    if (query.status === CouponStatus.CANCELLED) {
      filter.status = CouponStatus.CANCELLED;
    } else {
      filter.is_deleted = false;

      if (query.status === CouponStatus.ACTIVE) {
        filter.status = CouponStatus.ACTIVE;
        filter.end_date = { $gte: now };
      } else if (query.status === CouponStatus.INACTIVE) {
        filter.$or = [
          { status: CouponStatus.INACTIVE },
          { status: CouponStatus.ACTIVE, end_date: { $lt: now } },
        ];
      } else if (query.status) {
        filter.status = query.status;
      }
    }

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

    const formattedData = rawData.map((coupon) => {
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

  async findActiveCoupons() {
    const now = new Date();
    const activeCoupons = await this.couponModel
      .find({
        is_deleted: false,
        status: CouponStatus.ACTIVE,
        start_date: { $lte: now },
        end_date: { $gte: now },
        $expr: { $lt: ['$usage_count', '$usage_limit'] },
      })
      .select(
        'code discount_type discount_value min_order_value usage_count usage_limit start_date end_date',
      )
      .lean()
      .exec();

    return activeCoupons;
  }

  async findOne(id: string) {
    const coupon = await this.couponModel
      .findOne({ _id: id, is_deleted: false })
      .lean();
    if (!coupon) throw new NotFoundException('Không tìm thấy mã giảm giá');
    return coupon;
  }

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

  async updateCoupon(id: string, dto: UpdateCouponDto, userId?: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.is_deleted) {
      throw new NotFoundException('Không tìm thấy mã giảm giá');
    }

    const isCoreFieldChanged =
      (dto.discount_type && dto.discount_type !== coupon.discount_type) ||
      (dto.discount_value !== undefined &&
        Number(dto.discount_value) !== Number(coupon.discount_value)) ||
      (dto.min_order_value !== undefined &&
        Number(dto.min_order_value) !== Number(coupon.min_order_value)) ||
      (dto.usage_limit !== undefined &&
        Number(dto.usage_limit) !== Number(coupon.usage_limit));

    const oldScope = coupon.applicable_scope;
    const newScope = dto.applicable_scope;

    const hasScopeCurrently =
      !oldScope.isAllProducts &&
      (oldScope.categories.length > 0 ||
        oldScope.tags.length > 0 ||
        oldScope.products.length > 0);

    const isTryingToClearScope =
      newScope &&
      newScope.isAllProducts === true &&
      newScope.categories.length === 0 &&
      newScope.tags.length === 0 &&
      newScope.products.length === 0;

    const isScopeChanged =
      newScope && JSON.stringify(newScope) !== JSON.stringify(oldScope);

    // ĐÃ FIX: Thêm điều kiện isScopeChanged để bắt lỗi khi gỡ/thêm sản phẩm
    if (isCoreFieldChanged || isScopeChanged) {
      const targetStatus = dto.status || coupon.status;

      if (
        targetStatus !== CouponStatus.INACTIVE &&
        targetStatus !== CouponStatus.DRAFT &&
        targetStatus !== CouponStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Vui lòng chuyển mã giảm giá sang trạng thái Deactive (Inactive) hoặc Bản nháp (Draft) trước khi chỉnh sửa thông tin.',
        );
      }

      if (hasScopeCurrently && isCoreFieldChanged && !isTryingToClearScope) {
        throw new BadRequestException(
          'Mã giảm giá đang được áp dụng cho sản phẩm. Phải gỡ khỏi tất cả sản phẩm (chọn All Products) trước khi được sửa các thông tin khác.',
        );
      }

      // KIỂM TRA ĐƠN HÀNG BẤT KỂ LÀ SỬA TIỀN HAY GỠ SẢN PHẨM
      const hasOngoingOrder = await this.orderModel.exists({
        voucher_code: coupon.code,
        status: { $in: ONGOING_ORDER_STATUSES },
      });

      if (hasOngoingOrder) {
        throw new BadRequestException(
          'Mã giảm giá này đang nằm trong đơn hàng chưa hoàn tất. Vui lòng chờ đơn hoàn thành hoặc hủy đơn mới được phép chỉnh sửa.',
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
    if (!coupon.status) coupon.status = CouponStatus.DRAFT;

    const updatedCoupon = await coupon.save();

    await this.auditLogsService.log({
      action: 'UPDATE_COUPON',
      collection_name: 'coupons',
      actor_id: userId,
      target_id: updatedCoupon._id,
      department: Department.MARKETING,
      is_success: true,
    });

    return updatedCoupon;
  }

  async softDeleteCoupon(id: string, userId?: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.is_deleted)
      throw new NotFoundException('Không tìm thấy mã giảm giá');

    if (
      coupon.status !== CouponStatus.INACTIVE &&
      coupon.status !== CouponStatus.DRAFT &&
      coupon.status !== CouponStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Mã giảm giá phải ở trạng thái Deactive (Inactive) mới được phép xóa.',
      );
    }

    const hasScope =
      !coupon.applicable_scope.isAllProducts &&
      (coupon.applicable_scope.categories.length > 0 ||
        coupon.applicable_scope.tags.length > 0 ||
        coupon.applicable_scope.products.length > 0);

    if (hasScope) {
      throw new BadRequestException(
        'Mã giảm giá đang được gán cho sản phẩm/danh mục. Vui lòng sửa và gỡ khỏi tất cả sản phẩm trước khi xóa.',
      );
    }

    const hasOngoingOrder = await this.orderModel.exists({
      voucher_code: coupon.code,
      status: { $in: ONGOING_ORDER_STATUSES },
    });
    if (hasOngoingOrder) {
      throw new BadRequestException(
        'Không thể xóa! Mã giảm giá đang được sử dụng trong đơn hàng chưa hoàn tất.',
      );
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

  async bulkDelete(ids: string[], userId?: string) {
    const coupons = await this.couponModel.find({ _id: { $in: ids } });
    const deletableIds: string[] = [];

    for (const coupon of coupons) {
      if (
        coupon.status !== CouponStatus.INACTIVE &&
        coupon.status !== CouponStatus.DRAFT &&
        coupon.status !== CouponStatus.CANCELLED
      )
        continue;

      const hasScope =
        !coupon.applicable_scope.isAllProducts &&
        (coupon.applicable_scope.categories.length > 0 ||
          coupon.applicable_scope.tags.length > 0 ||
          coupon.applicable_scope.products.length > 0);
      if (hasScope) continue;

      const hasOngoingOrder = await this.orderModel.exists({
        voucher_code: coupon.code,
        status: { $in: ONGOING_ORDER_STATUSES },
      });
      if (hasOngoingOrder) continue;

      deletableIds.push(coupon._id as unknown as string);
    }

    if (deletableIds.length === 0) {
      throw new BadRequestException(
        'Không thể xóa. Tất cả mã giảm giá được chọn đều đang Active, đang áp dụng cho sản phẩm hoặc đang kẹt trong đơn hàng.',
      );
    }

    await this.couponModel.updateMany(
      { _id: { $in: deletableIds } },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          status: CouponStatus.CANCELLED,
        },
      },
    );

    if (userId) {
      await this.auditLogsService.log({
        action: 'BULK_DELETE_COUPONS',
        collection_name: 'coupons',
        actor_id: userId,
        target_id: 'BULK',
        department: Department.MARKETING,
        detail: { deleted_ids: deletableIds },
        is_success: true,
      });
    }

    // Trả về 200 để Frontend hiện Toast màu Vàng
    if (deletableIds.length < ids.length) {
      return {
        success: true,
        message:
          'Đã xóa. Tuy nhiên một số mã giảm giá bị chặn xóa do đang Active hoặc chưa gỡ hết sản phẩm.',
      };
    }

    return { success: true, message: 'Xóa hàng loạt thành công!' };
  }
}
