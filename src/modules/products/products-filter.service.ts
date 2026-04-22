import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Product, ProductDocument } from './catalog/schemas/product.schema';
import {
  Attribute,
  AttributeDocument,
} from './attributes/schemas/attribute.schema';
import {
  Category,
  CategoryDocument,
} from './categories/schemas/category.schema';
import { CategoriesService } from './categories/categories.service';
import { FilterProductDto } from './catalog/dto/filter-product.dto';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AttributeType } from 'src/common/enums/attribute-type.enum';

import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';
import {
  MemberTier,
  MemberTierDocument,
} from 'src/modules/marketing/loyalty/schemas/member-tier.schema';

// 1. ĐỊNH NGHĨA INTERFACE CHO KẾT QUẢ AGGREGATION
export interface CountResult {
  _id: { code: string; value: string };
  count: number;
}

export interface RangeResult {
  _id: string;
  min: number;
  max: number;
}

export interface AggregationFacetResult {
  counts: CountResult[];
  ranges: RangeResult[];
}

// 2. ĐỊNH NGHĨA INTERFACE CHO KẾT QUẢ CUỐI CÙNG
export interface FilterOutput {
  id: any;
  name: string;
  code: string;
  type: string;
  min?: number;
  max?: number;
  options?: any[];
}

@Injectable()
export class ProductFilterService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private readonly categoriesService: CategoriesService,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(MemberTier.name) private tierModel: Model<MemberTierDocument>,
  ) {}

  // API chính phục vụ Frontend (US.2)
  async getSmartFiltersForCategory(dto: FilterProductDto, userId?: string) {
    const { categorySlug, attributes } = dto;

    //Bắt buộc phải có định danh danh mục
    if (!categorySlug) {
      throw new BadRequestException('Vui lòng cung cấp categorySlug hoặc ID');
    }

    // 1. XỬ LÝ CATEGORY (ID hoặc SLUG)
    let targetCategoryId: Types.ObjectId;
    const categoryIdentifier = categorySlug;

    if (Types.ObjectId.isValid(categoryIdentifier)) {
      targetCategoryId = new Types.ObjectId(categoryIdentifier);
    } else {
      const category = await this.categoryModel
        .findOne({ slug: categoryIdentifier })
        .select('_id');

      if (!category) {
        throw new NotFoundException(
          `Không tìm thấy danh mục: ${categoryIdentifier}`,
        );
      }
      targetCategoryId = category._id;
    }

    // 2. LẤY CẤU HÌNH ATTRIBUTE
    const attributesConfig = await this.attributeModel
      .find({
        is_active: true,
        is_filterable: true,
        $or: [
          { applicable_categories: [] },
          { applicable_categories: targetCategoryId },
        ],
      })
      .sort({ sort_order: 1 })
      .lean();

    // Lấy tất cả ID con cháu
    const allCategoryIds =
      await this.categoriesService.getAllChildCategories(targetCategoryId);
    const filterCategoryIds = [targetCategoryId, ...allCategoryIds];

    // 3. XÂY DỰNG PIPELINE ($MATCH)
    const matchStage: FilterQuery<Product> = {
      categories: { $in: filterCategoryIds },
      status: ProductStatus.ACTIVE,
      is_deleted: false,
      stock: { $gt: 0 },
    };

    // XÁC ĐỊNH RANK CỦA USER
    let userRank = 0;
    if (userId) {
      const customer = await this.customerModel
        .findById(userId)
        .select('loyalty')
        .lean();
      const userTierCode = customer?.loyalty?.tier || 'SILVER';

      const tierConfig = await this.tierModel
        .findOne({ code: userTierCode })
        .lean();

      interface ExtendedTierData {
        rank_level?: number;
      }

      const tierData = tierConfig as unknown as ExtendedTierData;

      userRank = tierData?.rank_level ?? 0;
    }

    // BẢO MẬT HIỂN THỊ (AC14)
    // Chặn đếm số lượng các sản phẩm yêu cầu Rank cao hơn Rank hiện tại
    matchStage.$or = [
      { is_member_only: { $ne: true } }, // 1. Mở cho mọi người (Không phải hàng Member)
      {
        is_member_only: true,
        rank_required: { $lte: userRank }, // 2. Hàng Member NHƯNG user đủ Rank
      },
    ];

    // Apply filters đang chọn
    if (attributes) {
      const attributeFilters: FilterQuery<Product>[] = [];
      for (const [code, valuesStr] of Object.entries(attributes)) {
        if (!valuesStr) continue;
        const values = valuesStr
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v);
        if (values.length > 0) {
          attributeFilters.push({
            attributes: {
              $elemMatch: { code: code, value: { $in: values } },
            },
          });
        }
      }
      if (attributeFilters.length > 0) {
        matchStage.$and = attributeFilters;
      }
    }

    // 4. CHẠY AGGREGATION (FACET)
    const aggregationPipeline = [
      { $match: matchStage },
      { $unwind: '$attributes' },
      {
        $facet: {
          // Nhóm 1: Đếm số lượng cho List
          counts: [
            {
              $group: {
                _id: { code: '$attributes.code', value: '$attributes.value' },
                count: { $sum: 1 },
              },
            },
          ],
          // Nhóm 2: Tìm Min/Max cho Slider
          ranges: [
            {
              $match: { 'attributes.value': { $regex: /^\d+(\.\d+)?$/ } },
            },
            {
              $project: {
                code: '$attributes.code',
                valNum: { $toDouble: '$attributes.value' },
              },
            },
            {
              $group: {
                _id: '$code',
                min: { $min: '$valNum' },
                max: { $max: '$valNum' },
              },
            },
          ],
        },
      },
    ];

    // Truyền generic type vào aggregate để kết quả trả về có kiểu cụ thể
    const results =
      await this.productModel.aggregate<AggregationFacetResult>(
        aggregationPipeline,
      );

    // Lấy kết quả an toàn (đã có type từ interface AggregationFacetResult)
    const counts = results[0]?.counts || [];
    const ranges = results[0]?.ranges || [];

    // 5. CHUYỂN ĐỔI KẾT QUẢ SANG MAP
    const countMap = new Map<string, number>();

    // item giờ đã có kiểu CountResult, không còn là any
    counts.forEach((item) => {
      const key = `${item._id.code}_${item._id.value}`;
      countMap.set(key, item.count);
    });

    // 6. MAP DỮ LIỆU
    const finalFilters: FilterOutput[] = attributesConfig
      .map((attr) => {
        // Xử lý riêng cho Range Slider
        if (attr.display_type === AttributeType.RANGE_SLIDER) {
          // r có kiểu RangeResult
          const rangeData = ranges.find((r) => r._id === attr.code);
          return {
            id: attr._id,
            name: attr.name,
            code: attr.code,
            type: attr.display_type,
            // rangeData có kiểu, truy cập min/max an toàn
            min: rangeData ? rangeData.min : 0,
            max: rangeData ? rangeData.max : 0,
            options: [],
          };
        }

        // Xử lý cho các loại List (Text, Button, Color)
        const processedOptions = attr.values.map((opt) => {
          const key = `${attr.code}_${opt.value}`;
          const count = countMap.get(key) || 0;
          return {
            ...opt,
            count: count,
            disabled: count === 0, // Smart Hiding (AC4)
          };
        });

        // Sắp xếp (AC11)
        const valueOrderMap = new Map<string, number>();
        attr.values.forEach((val, index) =>
          valueOrderMap.set(val.value, index),
        );

        processedOptions.sort((a, b) => {
          if (a.count === 0 && b.count > 0) return 1;
          if (b.count === 0 && a.count > 0) return -1;
          const indexA = valueOrderMap.get(a.value) ?? 999;
          const indexB = valueOrderMap.get(b.value) ?? 999;
          return indexA - indexB;
        });

        return {
          id: attr._id,
          name: attr.name,
          code: attr.code,
          type: attr.display_type,
          options: processedOptions,
        };
      })
      // Filter thông minh: Giữ lại Slider nếu có Data, Giữ lại List nếu có Option
      // attr giờ có kiểu FilterOutput, không cần ép kiểu as any
      .filter((attr) => {
        if (attr.type === AttributeType.RANGE_SLIDER) {
          return (attr.max || 0) > (attr.min || 0);
        }
        return attr.options?.some((o) => !o.disabled) ?? false;
      });

    return finalFilters;
  }
}
