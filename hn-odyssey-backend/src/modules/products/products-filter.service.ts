import {
  Injectable,
  NotFoundException, // Đã xóa BadRequestException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, PipelineStage } from 'mongoose'; // Import thêm PipelineStage
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
export interface TagResult {
  _id: string;
  count: number;
}
export interface PriceResult {
  _id: null;
  min: number;
  max: number;
}
export interface AggregationFacetResult {
  counts: CountResult[];
  ranges: RangeResult[];
  tags: TagResult[];
  price: PriceResult[];
}

// 2. ĐỊNH NGHĨA INTERFACE CHO KẾT QUẢ CUỐI CÙNG
export interface FilterOutput {
  id: string;
  name: string;
  code: string;
  type: string;
  min?: number;
  max?: number;
  options?: {
    label: string;
    value: string;
    count: number;
    disabled: boolean;
    meta?: string;
  }[];
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

  async getSmartFiltersForCategory(dto: FilterProductDto, userId?: string) {
    const { categorySlug, attributes } = dto;
    const isAllCategories =
      !categorySlug || categorySlug.toLowerCase() === 'all';

    let targetCategoryId: Types.ObjectId | undefined;
    let filterCategoryIds: Types.ObjectId[] = [];

    if (!isAllCategories) {
      if (Types.ObjectId.isValid(categorySlug)) {
        targetCategoryId = new Types.ObjectId(categorySlug);
      } else {
        const category = await this.categoryModel
          .findOne({ slug: categorySlug })
          .select('_id');
        if (!category) {
          throw new NotFoundException(
            `Không tìm thấy danh mục: ${categorySlug}`,
          );
        }
        targetCategoryId = category._id;
      }
      const allCategoryIds =
        await this.categoriesService.getAllChildCategories(targetCategoryId);
      filterCategoryIds = [targetCategoryId, ...allCategoryIds];
    }

    const attributeQuery: FilterQuery<Attribute> = {
      is_active: true,
      is_filterable: true,
    };
    if (targetCategoryId) {
      attributeQuery.$or = [
        { applicable_categories: [] },
        { applicable_categories: targetCategoryId },
      ];
    } else {
      attributeQuery.applicable_categories = [];
    }

    const attributesConfig = await this.attributeModel
      .find(attributeQuery)
      .sort({ sort_order: 1 })
      .lean();

    const matchStage: FilterQuery<Product> = {
      status: ProductStatus.ACTIVE,
      is_deleted: false,
      stock: { $gt: 0 },
    };

    if (filterCategoryIds.length > 0) {
      matchStage.categories = { $in: filterCategoryIds };
    }

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
      userRank = (tierConfig as unknown as ExtendedTierData)?.rank_level ?? 0;
    }

    matchStage.$or = [
      { is_member_only: { $ne: true } },
      { is_member_only: true, rank_required: { $lte: userRank } },
    ];

    // PHÂN LOẠI FILTER ĐẨY XUỐNG TỪ FRONTEND (Tách Tags, Price ra khỏi Attributes)
    if (attributes) {
      const attributeFilters: FilterQuery<Product>[] = [];
      for (const [code, valuesStr] of Object.entries(attributes)) {
        if (!valuesStr) continue;
        const values = valuesStr
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v);

        if (values.length > 0) {
          if (code === 'tags') {
            matchStage.tags = { $in: values };
          } else if (code === 'price') {
            if (values.length === 2) {
              matchStage.$expr = {
                $and: [
                  {
                    $gte: [
                      {
                        $cond: [
                          { $gt: ['$sale_price', 0] },
                          '$sale_price',
                          '$price',
                        ],
                      },
                      Number(values[0]),
                    ],
                  },
                  {
                    $lte: [
                      {
                        $cond: [
                          { $gt: ['$sale_price', 0] },
                          '$sale_price',
                          '$price',
                        ],
                      },
                      Number(values[1]),
                    ],
                  },
                ],
              };
            }
          } else {
            attributeFilters.push({
              attributes: {
                $elemMatch: { code: code, value: { $in: values } },
              },
            });
          }
        }
      }
      if (attributeFilters.length > 0) {
        matchStage.$and = attributeFilters;
      }
    }

    // AGGREGATION FACET: Đã định nghĩa kiểu PipelineStage để fix lỗi Type
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage as Record<string, any> },
      {
        $facet: {
          // Đếm thuộc tính động
          counts: [
            { $unwind: '$attributes' },
            {
              $group: {
                _id: { code: '$attributes.code', value: '$attributes.value' },
                count: { $sum: 1 },
              },
            },
          ],
          // Đếm thẻ (Tags)
          tags: [
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          // Tính Min/Max giá của toàn bộ danh sách
          price: [
            {
              $group: {
                _id: null,
                min: {
                  $min: {
                    $cond: [
                      { $gt: ['$sale_price', 0] },
                      '$sale_price',
                      '$price',
                    ],
                  },
                },
                max: {
                  $max: {
                    $cond: [
                      { $gt: ['$sale_price', 0] },
                      '$sale_price',
                      '$price',
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const results =
      await this.productModel.aggregate<AggregationFacetResult>(
        aggregationPipeline,
      );

    const counts = results[0]?.counts || [];
    const tags = results[0]?.tags || [];
    const priceData = results[0]?.price[0];

    const countMap = new Map<string, number>();
    counts.forEach((item) => {
      countMap.set(`${item._id.code}_${item._id.value}`, item.count);
    });

    const finalFilters: FilterOutput[] = attributesConfig.map((attr) => {
      const processedOptions = attr.values.map((opt) => {
        const count = countMap.get(`${attr.code}_${opt.value}`) || 0;
        return { ...opt, count, disabled: count === 0 };
      });

      const valueOrderMap = new Map<string, number>();
      attr.values.forEach((val, index) => valueOrderMap.set(val.value, index));

      processedOptions.sort((a, b) => {
        return (
          (valueOrderMap.get(a.value) ?? 999) -
          (valueOrderMap.get(b.value) ?? 999)
        );
      });

      return {
        id: attr._id.toString(),
        name: attr.name,
        code: attr.code,
        type: attr.display_type,
        options: processedOptions,
      };
    });
    // .filter((attr) => attr.options?.some((o) => !o.disabled) ?? false);

    // TỰ ĐỘNG THÊM FILTER TAGS VÀO UI
    if (tags.length > 0) {
      finalFilters.push({
        id: 'tags_filter_id',
        name: 'Tags & Collections',
        code: 'tags',
        type: AttributeType.BUTTON, // Hiển thị dạng Button trên Frontend
        options: tags.map((t) => ({
          label: t._id.replace(/-/g, ' ').toUpperCase(), // Format đẹp (vd: hn-odyssey -> HN ODYSSEY)
          value: t._id,
          count: t.count,
          disabled: false,
        })),
      });
    }

    // TỰ ĐỘNG THÊM FILTER PRICE RANGE VÀO UI
    if (priceData && priceData.max >= priceData.min) {
      finalFilters.unshift({
        id: 'price_filter_id',
        name: 'Price Range',
        code: 'price',
        type: AttributeType.RANGE_SLIDER,
        min: Math.floor(priceData.min),
        max: Math.ceil(priceData.max),
        options: [],
      });
    }

    return finalFilters;
  }
}
