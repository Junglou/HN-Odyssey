import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
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
  private readonly FREESHIP_THRESHOLD = 150; // Hệ USD

  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
  ) {}

  async getCartRecommendations(
    sessionId: string,
    userId: string | undefined,
    currentTotal: number,
    excludeIdsStr?: string,
  ) {
    const cartMatch = userId
      ? { user_id: new Types.ObjectId(userId) }
      : { session_id: sessionId };

    const currentCart = await this.cartModel.findOne(cartMatch).lean();
    const cartProductIds = currentCart?.items.map((i) => i.product_id) || [];

    const excludeList = excludeIdsStr ? excludeIdsStr.split(',') : [];
    const mergedExcludeIds = [
      ...new Set([...cartProductIds.map(String), ...excludeList]),
    ];
    const objectIdsToExclude = mergedExcludeIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    // --- 1. LẤY HỒ SƠ GU CÁ NHÂN (USER AFFINITY) ĐỂ CÁ NHÂN HÓA ---
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

      const viewedProductIds = userBehaviors
        .map((b) => b.metadata?.product_id)
        .filter((id) => typeof id === 'string' && Types.ObjectId.isValid(id));

      if (viewedProductIds.length > 0) {
        const viewedProducts = await this.productModel
          .find({ _id: { $in: viewedProductIds } })
          .select('categories')
          .lean();

        // [FIX ESLINT]: Bóc tách dữ liệu Category an toàn
        userAffinityCategoryIds = [
          ...new Set(
            viewedProducts
              .flatMap((p) => p.categories)
              .map((c) => {
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

    const baseQuery: FilterQuery<ProductDocument> = {
      _id: { $nin: objectIdsToExclude },
      status: 'ACTIVE',
      is_deleted: false,
      stock: { $gt: 0 },
    };

    const prioritySort: Record<string, 1 | -1> = {
      is_flash_sale: -1,
      margin_tier: -1,
      rating_average: -1,
    };

    // --- 2. KỊCH BẢN GIỎ HÀNG TRỐNG ---
    if (cartProductIds.length === 0) {
      const emptyCartQuery: FilterQuery<ProductDocument> = {
        ...baseQuery,
        tags: { $in: ['Trending', 'trending', 'best seller', 'new arrival'] },
      };

      if (userAffinityCategoryIds.length > 0) {
        emptyCartQuery.categories = { $in: userAffinityCategoryIds };
      }

      let recs = (await this.productModel
        .find(emptyCartQuery)
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];

      if (recs.length < 6) {
        const currentRecIds = recs.map((r) => r._id);
        const fallback = (await this.productModel
          .find({
            ...baseQuery,
            _id: { $nin: [...objectIdsToExclude, ...currentRecIds] },
            tags: { $in: ['Trending', 'trending', 'best seller'] },
          })
          .sort(prioritySort)
          .limit(6 - recs.length)
          .lean()) as unknown as ProductDocument[];
        recs = [...recs, ...fallback];
      }
      return recs;
    }

    // --- 3. KỊCH BẢN GIỎ HÀNG CÓ ĐỒ ---
    const cartProducts = await this.productModel
      .find({ _id: { $in: cartProductIds } })
      .select('categories tags')
      .lean();

    // [FIX ESLINT]: Bóc tách dữ liệu Category an toàn
    const cartCategoryIds = cartProducts
      .flatMap((p) => p.categories)
      .map((c) => {
        if (c instanceof Types.ObjectId) return c.toHexString();
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && '_id' in c) {
          return String((c as { _id: unknown })._id);
        }
        return '';
      })
      .filter((id) => id !== '');

    const cartTags = cartProducts.flatMap((p) => p.tags || []);

    const combinedCategories = [
      ...new Set([...cartCategoryIds, ...userAffinityCategoryIds]),
    ];

    const contextQuery: FilterQuery<ProductDocument> = {
      ...baseQuery,
      $or: [
        { categories: { $in: combinedCategories } },
        { tags: { $in: cartTags } },
      ],
    };

    let recommendedProducts: ProductDocument[] = [];

    // THUẬT TOÁN GAP FILLING (Mồi Freeship)
    if (currentTotal > 0 && currentTotal < this.FREESHIP_THRESHOLD) {
      const gap = this.FREESHIP_THRESHOLD - currentTotal;
      const minPrice = Math.max(gap * 0.3, 5);
      const maxPrice = Math.max(gap * 1.5, 45);

      recommendedProducts = (await this.productModel
        .find({
          ...contextQuery,
          $or: [
            { sale_price: { $gt: 0, $gte: minPrice, $lte: maxPrice } },
            {
              sale_price: { $in: [0, null] },
              price: { $gte: minPrice, $lte: maxPrice },
            },
          ],
        })
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];

      if (recommendedProducts.length === 0) {
        recommendedProducts = (await this.productModel
          .find({
            ...baseQuery,
            $or: [
              { sale_price: { $gt: 0, $gte: minPrice, $lte: maxPrice } },
              {
                sale_price: { $in: [0, null] },
                price: { $gte: minPrice, $lte: maxPrice },
              },
            ],
          })
          .sort(prioritySort)
          .limit(6)
          .lean()) as unknown as ProductDocument[];
      }
    }

    // THUẬT TOÁN IMPULSE BUYING
    if (recommendedProducts.length === 0) {
      const impulseLimit = currentTotal > 0 ? currentTotal * 0.4 : 30;
      const finalImpulseLimit = Math.max(impulseLimit, 20);

      recommendedProducts = (await this.productModel
        .find({
          ...contextQuery,
          $or: [
            { sale_price: { $gt: 0, $lt: finalImpulseLimit } },
            {
              sale_price: { $in: [0, null] },
              price: { $lt: finalImpulseLimit },
            },
          ],
        })
        .sort(prioritySort)
        .limit(6)
        .lean()) as unknown as ProductDocument[];
    }

    // --- 4. BÙ ĐẮP SẢN PHẨM CHỐNG TRÙNG LẶP ---
    if (recommendedProducts.length < 6) {
      const currentRecIds = recommendedProducts.map((p) => p._id);
      const additionalExcludes = [...objectIdsToExclude, ...currentRecIds];

      if (userAffinityCategoryIds.length > 0) {
        const personalizedFiller = (await this.productModel
          .find({
            _id: { $nin: additionalExcludes },
            status: 'ACTIVE',
            is_deleted: false,
            stock: { $gt: 0 },
            categories: { $in: userAffinityCategoryIds },
          })
          .sort(prioritySort)
          .limit(6 - recommendedProducts.length)
          .lean()) as unknown as ProductDocument[];

        recommendedProducts = [...recommendedProducts, ...personalizedFiller];
      }

      if (recommendedProducts.length < 6) {
        const finalExcludes = [
          ...objectIdsToExclude,
          ...recommendedProducts.map((p) => p._id),
        ];
        const fillerProducts = (await this.productModel
          .find({
            _id: { $nin: finalExcludes },
            status: 'ACTIVE',
            is_deleted: false,
            stock: { $gt: 0 },
            tags: { $in: ['Trending', 'best seller', 'camping essentials'] },
          })
          .sort(prioritySort)
          .limit(6 - recommendedProducts.length)
          .lean()) as unknown as ProductDocument[];

        recommendedProducts = [...recommendedProducts, ...fillerProducts];
      }
    }

    return recommendedProducts;
  }
}
