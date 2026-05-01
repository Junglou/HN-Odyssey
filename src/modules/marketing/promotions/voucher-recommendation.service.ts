import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Coupon,
  CouponDocument,
  CouponStatus,
  DiscountType,
} from './schemas/coupon.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';

export interface IVoucherSuggestion {
  coupon: CouponDocument;
  is_eligible: boolean;
  missing_amount: number;
  progress_percent: number;
  suggestion_message: string;
  tags: string[]; // 'NEW', 'VIP', 'SHIPPING', 'URGENT', 'BEST_SHIPPING'
}

export interface ICartContext {
  total_value: number;
  category_ids: string[];
  delivery_province_id?: string; // Bổ sung tham số từ AC6
}

@Injectable()
export class VoucherRecommendationService {
  private readonly logger = new Logger(VoucherRecommendationService.name);

  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  // BỔ SUNG: Hàm tính toán giá trị giảm thực tế để chuẩn hóa phép so sánh
  private calculateActualDiscount(
    coupon: CouponDocument,
    cartTotal?: number,
  ): number {
    if (coupon.discount_type === DiscountType.PERCENTAGE) {
      // Nếu không ở ngữ cảnh giỏ hàng (không có cartTotal), tạm dùng giá trị % làm trọng số
      if (!cartTotal) return coupon.discount_value;

      let calculatedDiscount = (cartTotal * coupon.discount_value) / 100;

      // Ép kiểu an toàn (Strict Typing) để lấy max_discount_value nếu DB có lưu
      const couponExtended = coupon as unknown as {
        max_discount_value?: number;
      };

      if (
        couponExtended.max_discount_value &&
        calculatedDiscount > couponExtended.max_discount_value
      ) {
        calculatedDiscount = couponExtended.max_discount_value;
      }

      return calculatedDiscount;
    }

    // Nếu là FIXED_AMOUNT, trả về đúng số tiền giảm
    return coupon.discount_value;
  }

  // AC1, AC2, AC3, AC4, AC6: Gợi ý Voucher theo Context (Trang chủ, Chi tiết SP, Giỏ hàng)
  async getRecommendedVouchers(
    userId: string | undefined,
    context: 'HOME' | 'PRODUCT' | 'CART',
    cartContext?: ICartContext,
    productId?: string,
  ): Promise<IVoucherSuggestion[]> {
    const now = new Date();
    let isNewUser = true;
    let userTier = 'MEMBER';

    // 1. Phân tích đối tượng (AC3: Segmentation)
    if (userId && Types.ObjectId.isValid(userId)) {
      const user = await this.customerModel
        .findById(userId)
        .select('loyalty')
        .lean();
      if (user) {
        isNewUser = user.loyalty?.total_spent === 0;
        userTier = user.loyalty?.tier || 'MEMBER';
      }
    }

    // 2. Build Query lấy Voucher hợp lệ
    const query: Record<string, unknown> = {
      status: CouponStatus.ACTIVE,
      is_deleted: false,
      start_date: { $lte: now },
      end_date: { $gte: now },
    };

    // AC3: Logic chặn - Khách thường không thấy mã VIP
    if (userTier !== 'GOLD' && userTier !== 'DIAMOND') {
      query['code'] = { $not: /^VIP/i }; // Giả định mã VIP bắt đầu bằng chữ VIP
    }

    const activeCoupons = await this.couponModel.find(query).lean();
    const suggestions: IVoucherSuggestion[] = [];

    for (const coupon of activeCoupons) {
      let isEligible = false;
      let missingAmount = 0;
      let progressPercent = 0;
      let message = '';
      const tags: string[] = [];

      // Phân loại thẻ (Tags) & AC6: Logic Shipping
      if (coupon.code.startsWith('FREESHIP')) {
        tags.push('SHIPPING');

        // BỔ SUNG LOGIC AC6: Kiểm tra tính hợp lệ của địa chỉ giao hàng
        const couponData = coupon as unknown as {
          applied_provinces?: string[];
        };
        const appliedProvinces: string[] = couponData.applied_provinces || [];

        if (context === 'CART' && cartContext?.delivery_province_id) {
          // Nếu mã này chỉ áp dụng cho một số tỉnh nhất định mà tỉnh giao hàng không nằm trong đó -> Bỏ qua
          if (
            appliedProvinces.length > 0 &&
            !appliedProvinces.includes(cartContext.delivery_province_id)
          ) {
            continue;
          } else {
            // Nếu hợp lệ (mã toàn quốc hoặc đúng tỉnh), dán nhãn ưu tiên cao nhất
            tags.push('BEST_SHIPPING');
          }
        }
      }

      if (coupon.code.startsWith('NEW')) tags.push('NEW');
      if (coupon.code.startsWith('VIP')) tags.push('VIP');

      const hoursLeft =
        (coupon.end_date.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursLeft <= 24) tags.push('URGENT'); // AC4: Sắp hết hạn

      // Lọc theo ngữ cảnh (AC1)
      if (context === 'HOME') {
        if (tags.includes('NEW') && !isNewUser) continue; // Khách cũ không thấy mã New
        isEligible = true;
        message = 'Lưu mã để sử dụng khi thanh toán';
      } else if (context === 'PRODUCT' && productId) {
        isEligible = true;
        message = 'Mã áp dụng được cho sản phẩm bạn đang xem';
      } else if (context === 'CART' && cartContext) {
        missingAmount = coupon.min_order_value - cartContext.total_value;
        if (missingAmount <= 0) {
          isEligible = true;
          progressPercent = 100;
          message = 'Đủ điều kiện áp dụng!';
        } else {
          isEligible = false;
          progressPercent = Math.round(
            (cartContext.total_value / coupon.min_order_value) * 100,
          );

          // AC2: Logic Upsell (Chỉ gợi ý nếu thiếu dưới 30% giá trị giỏ)
          if (
            missingAmount <= cartContext.total_value * 0.3 ||
            missingAmount <= 100000
          ) {
            message = `Mua thêm ${missingAmount.toLocaleString('vi-VN')}đ để được giảm ${coupon.discount_value.toLocaleString('vi-VN')}${coupon.discount_type === DiscountType.PERCENTAGE ? '%' : 'đ'}`;
          } else {
            continue; // Bỏ qua không hiển thị nếu khoảng cách quá xa
          }
        }
      }

      suggestions.push({
        coupon: coupon as unknown as CouponDocument,
        is_eligible: isEligible,
        missing_amount: missingAmount > 0 ? missingAmount : 0,
        progress_percent: progressPercent,
        suggestion_message: message,
        tags,
      });
    }

    // AC4 & AC6: Smart Sorting
    return suggestions.sort((a, b) => {
      // Ưu tiên 0: Mã vận chuyển tối ưu nhất cho địa chỉ hiện tại (AC6)
      if (a.tags.includes('BEST_SHIPPING') && !b.tags.includes('BEST_SHIPPING'))
        return -1;
      if (!a.tags.includes('BEST_SHIPPING') && b.tags.includes('BEST_SHIPPING'))
        return 1;

      // Ưu tiên 1: Mã sắp hết hạn (AC4)
      if (a.tags.includes('URGENT') && !b.tags.includes('URGENT')) return -1;
      if (!a.tags.includes('URGENT') && b.tags.includes('URGENT')) return 1;

      // Ưu tiên 2: Mã đủ điều kiện dùng
      if (a.is_eligible && !b.is_eligible) return -1;
      if (!a.is_eligible && b.is_eligible) return 1;

      // Ưu tiên 3: Giá trị giảm cao nhất tính trên đơn hàng hiện tại
      const actualDiscountA = this.calculateActualDiscount(
        a.coupon,
        cartContext?.total_value,
      );
      const actualDiscountB = this.calculateActualDiscount(
        b.coupon,
        cartContext?.total_value,
      );

      if (actualDiscountA !== actualDiscountB) {
        return actualDiscountB - actualDiscountA; // Giảm dần
      }

      // [ĐÃ FIX LỖI AC4]: Ưu tiên 4: Mã có điều kiện dễ đạt được nhất (min_order_value thấp nhất)
      return a.coupon.min_order_value - b.coupon.min_order_value; // Tăng dần
    });
  }
}
