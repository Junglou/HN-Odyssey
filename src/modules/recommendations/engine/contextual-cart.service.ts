import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';

@Injectable()
export class ContextualCartService {
  private readonly FREESHIP_THRESHOLD = 500000;

  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
  ) {}

  async getCartRecommendations(
    sessionId: string,
    userId: string | undefined,
    currentTotal: number,
  ) {
    const cartMatch = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: sessionId };
    const currentCart = await this.cartModel.findOne(cartMatch).lean();
    const cartProductIds = currentCart?.items.map((i) => i.product_id) || [];

    // AC8: Xử lý giỏ hàng rỗng (Empty Cart State)
    // Nếu giỏ hàng không có gì, trả về ngay hàng Trending và thoát sớm, không chạy Upsell/Cross-sell
    if (cartProductIds.length === 0) {
      const trendingProducts = await this.productModel
        .find({
          status: 'ACTIVE',
          is_deleted: false,
          stock: { $gt: 0 },
          tags: { $in: ['Trending', 'trending'] },
        })
        .sort({ is_flash_sale: -1, margin_tier: -1, rating_average: -1 })
        .limit(8)
        .lean();

      return trendingProducts as unknown as ProductDocument[];
    }

    const cartProducts = await this.productModel
      .find({ _id: { $in: cartProductIds } })
      .select('categories tags')
      .lean();

    const cartCategoryIds = cartProducts.flatMap((p) => p.categories);
    const cartTags = cartProducts.flatMap((p) => p.tags || []);
    const hasBulkyItem =
      cartTags.includes('bulky') || cartTags.includes('cong-kenh');
    // [FIX AC18]: Đổi logic sang kiểm tra tính tương thích đồ dã ngoại
    const isCampingCart = cartTags.some((tag) =>
      ['tent', 'cam-trai', 'leu'].includes(tag.toLowerCase()),
    );

    const isTrekkingCart = cartTags.some((tag) =>
      ['giay-trekking', 'balo-leo-nui', 'hiking'].includes(tag.toLowerCase()),
    );

    const excludedTags = ['flight-restricted', 'liquid'];
    if (hasBulkyItem) excludedTags.push('fragile', 'de-vo');

    const baseQuery: Record<string, unknown> = {
      _id: { $nin: cartProductIds },
      status: 'ACTIVE',
      is_deleted: false,
      stock: { $gt: 0 },
      max_purchase_qty: { $ne: 0 },
      tags: { $nin: excludedTags },
    };

    // Áp dụng tính tương thích
    if (isCampingCart) {
      const currentTagsQuery = baseQuery.tags as Record<string, unknown>;
      baseQuery.tags = {
        ...currentTagsQuery,
        $in: ['phu-kien-cam-trai', 'coc-leu', 'den-pin', 'tui-ngu'], // Nếu mua lều, gợi ý túi ngủ/đèn pin
      };
    } else if (isTrekkingCart) {
      const currentTagsQuery = baseQuery.tags as Record<string, unknown>;
      baseQuery.tags = {
        ...currentTagsQuery,
        $in: ['vo-merino', 'binh-nuoc', 'gay-leo-nui'], // Nếu mua giày/balo, gợi ý vớ/bình nước/gậy
      };
    }

    // [FIX AC16]: Behavior-based Recommendation (Nếu user đăng nhập)
    let userAffinityCategoryIds: string[] = [];
    if (userId) {
      const userBehaviors = await this.behaviorModel
        .find({
          user_id: new Types.ObjectId(userId),
          action: {
            $in: [BehaviorAction.VIEW_PRODUCT, BehaviorAction.ADD_TO_CART],
          },
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // [FIX 1: no-unnecessary-type-assertion]: Dùng typeof an toàn thay vì as string
      const viewedProductIds = userBehaviors
        .map((b) => b.metadata?.product_id)
        .filter((id) => typeof id === 'string' && Types.ObjectId.isValid(id));

      if (viewedProductIds.length > 0) {
        const viewedProducts = await this.productModel
          .find({ _id: { $in: viewedProductIds } })
          .select('categories')
          .lean();

        userAffinityCategoryIds = [
          ...new Set(
            viewedProducts
              .flatMap((p) => p.categories)
              .map((c) => {
                // [FIX 2: no-base-to-string]: Phân loại rạch ròi kiểu dữ liệu của category
                if (c instanceof Types.ObjectId) return c.toHexString();
                if (typeof c === 'string') return c;
                if (c && typeof c === 'object' && '_id' in c) {
                  return String((c as { _id: unknown })._id);
                }
                return '';
              })
              .filter((id) => id !== ''),
          ),
        ];
      }
    }

    // [FIX AC14 & AC17]: Object Sort ưu tiên Event FlashSale -> Lợi nhuận -> Rating
    const prioritySort: Record<string, 1 | -1> = {
      is_flash_sale: -1,
      margin_tier: -1,
      rating_average: -1,
    };

    let recommendedProducts: ProductDocument[] = [];

    // AC2: Threshold Gap Filling (Lấp đầy Freeship)
    if (currentTotal > 0 && currentTotal < this.FREESHIP_THRESHOLD) {
      const gap = this.FREESHIP_THRESHOLD - currentTotal;

      const gapQuery: Record<string, unknown> = {
        ...baseQuery,
        // [FIX CHO HIGH-END]: Đảm bảo giá gợi ý ít nhất cũng phải từ 400k trở lên,
        // cho dù gap có nhỏ đến mức nào.
        sale_price: {
          $gte: Math.max(gap * 0.8, 400000),
          $lte: Math.max(gap * 2.0, 2500000),
        },
      };

      if (userAffinityCategoryIds.length > 0) {
        gapQuery.categories = { $in: userAffinityCategoryIds };
      }

      recommendedProducts = (await this.productModel
        .find(gapQuery)
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];
    }

    // AC3: Impulse Buying (Mua ngẫu hứng)
    if (recommendedProducts.length === 0) {
      // [FIX CHO HIGH-END]: Đồ mua ngẫu hứng ở phân khúc này dao động từ 500k - 1.5 triệu.
      const impulseLimit = currentTotal > 0 ? currentTotal * 0.25 : 1500000;
      const finalImpulseLimit = Math.max(impulseLimit, 1500000); // Tối thiểu quét đồ < 1.5 triệu

      // Tạo object query linh hoạt thay vì fix cứng Regex
      const impulseQuery: Record<string, unknown> = {
        ...baseQuery,
        sale_price: { $lt: finalImpulseLimit },
      };

      // CHỈ GẮN ĐIỀU KIỆN LỌC CATEGORY NẾU GIỎ HÀNG THỰC SỰ CÓ ĐỒ
      if (cartCategoryIds.length > 0) {
        impulseQuery.categories = { $in: cartCategoryIds };
      }

      recommendedProducts = (await this.productModel
        .find(impulseQuery)
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];
    }

    // [FIX AC15]: Logic xung đột (Conflict Handling) - Ẩn gói quà nếu đã thêm
    const hasGiftWrapInCart = cartTags.includes('gift-wrap');
    const serviceTagsToSuggest = ['service', 'warranty']; // Luôn có thể gợi ý bảo hành

    if (!hasGiftWrapInCart) {
      serviceTagsToSuggest.push('gift-wrap'); // Chỉ gợi ý gói quà nếu giỏ hàng chưa có
    }

    // AC9: Service Upselling
    const serviceProducts = (await this.productModel
      .find({
        _id: { $nin: cartProductIds },
        status: 'ACTIVE',
        is_deleted: false,
        tags: { $in: serviceTagsToSuggest }, // Đã áp dụng bộ lọc xung đột
      })
      .select('name sku price sale_price thumbnail stock tags')
      .limit(2)
      .lean()) as unknown as ProductDocument[];

    if (serviceProducts.length > 0) {
      recommendedProducts = [...serviceProducts, ...recommendedProducts].slice(
        0,
        8,
      );
    }

    // AC8: Fallback Empty Cart
    if (recommendedProducts.length === 0) {
      recommendedProducts = (await this.productModel
        .find({ ...baseQuery, tags: 'Trending' })
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];
    }

    return recommendedProducts;
  }
}
