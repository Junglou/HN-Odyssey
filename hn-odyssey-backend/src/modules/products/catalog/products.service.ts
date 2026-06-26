import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductAttributeParams,
  PriceRequestStatus,
  PriceRequest,
} from './schemas/product.schema';
import {
  CreateProductDto,
  CreateProductVariantDto,
} from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import defaultSlugify from 'slugify';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AuditLogsService } from '../../system/audit-logs/audit-logs.service';
import { TagsService } from '../tags/tags.service';
import sanitizeHtml from 'sanitize-html';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { FilterProductDto, SortOption } from './dto/filter-product.dto';
import { Department } from 'src/common/enums/department.enum';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { CategoriesService } from '../categories/categories.service';
import {
  Attribute,
  AttributeDocument,
} from '../attributes/schemas/attribute.schema';
import { AttributeType } from 'src/common/enums/attribute-type.enum';
import {
  CategorySimple,
  ProductAttribute,
  ProductQueryParam,
  VariantInput,
} from 'src/common/interfaces/product.interface';
import { LoyaltyService } from 'src/modules/marketing/loyalty/loyalty.service';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';
import {
  MemberTier,
  MemberTierDocument,
} from 'src/modules/marketing/loyalty/schemas/member-tier.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlgoliaService } from 'src/modules/search/algolia.service';
import { MediaService } from 'src/modules/marketing/content/media.service';
import { UploadService } from 'src/modules/system/upload/upload.service';

interface PopulatedCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
}

export interface ICategoryDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent_id?: Types.ObjectId | null;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
    private readonly tagsService: TagsService,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly categoriesService: CategoriesService,
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    private readonly loyaltyService: LoyaltyService,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(MemberTier.name) private tierModel: Model<MemberTierDocument>,
    private readonly algoliaService: AlgoliaService,
    private readonly mediaService: MediaService,
    private readonly uploadService: UploadService,
  ) {}

  // Chỉ tính các đơn hàng đang trong quá trình (Chưa Done)
  private readonly ONGOING_ORDER_STATUSES = [
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

  async syncToSearchEngine(product: ProductDocument) {
    const populatedProduct = await this.productModel
      .findById(product._id)
      .populate<{ categories: PopulatedCategory[] }>('categories', 'name slug')
      .lean()
      .exec();

    if (!populatedProduct || !populatedProduct.categories) {
      console.warn(
        `[Algolia] Sản phẩm ${product.sku} không có danh mục hợp lệ.`,
      );
      return;
    }

    // [FIX 2]: Lọc bỏ các biến thể chưa duyệt giá (active = false) trước khi đẩy lên Algolia
    if (populatedProduct.has_variants && populatedProduct.variants) {
      const activeVariants = populatedProduct.variants.filter(
        (v) => v.active === true || v.price > 0,
      );
      populatedProduct.variants = activeVariants;

      // Xóa sổ tùy chọn (VD: Nút bấm màu Xanh) khỏi Algolia nếu không có biến thể nào chứa nó đang active
      const activeAttrSet = new Set<string>();
      activeVariants.forEach((v) => {
        v.attributes.forEach((attr) => {
          activeAttrSet.add(`${attr.code}_${attr.value}`);
        });
      });

      populatedProduct.attributes = populatedProduct.attributes.filter((attr) =>
        activeAttrSet.has(`${attr.code}_${attr.value}`),
      );
    }

    const categoryHierarchy: string[] = populatedProduct.categories.map(
      (c) => c.name,
    );

    // Sử dụng biến product gốc thay vì populatedProduct
    await this.algoliaService.syncProduct(product, categoryHierarchy);

    console.log(
      `[Algolia] Đã đồng bộ SKU: ${product.sku} với categories:`,
      categoryHierarchy,
    );
  }

  private async validateAttributesExist(variants: CreateProductVariantDto[]) {
    if (!variants || variants.length === 0) return;

    const inputAttributes = new Map<string, Set<string>>();
    variants.forEach((v) => {
      v.attributes.forEach((attr) => {
        let valuesSet = inputAttributes.get(attr.code);
        if (!valuesSet) {
          valuesSet = new Set<string>();
          inputAttributes.set(attr.code, valuesSet);
        }
        valuesSet.add(attr.value);
      });
    });

    const codes = Array.from(inputAttributes.keys());
    const dbAttributes = await this.attributeModel
      .find({ code: { $in: codes } })
      .lean();

    if (dbAttributes.length !== codes.length) {
      const foundCodes = dbAttributes.map((a) => a.code);
      const missing = codes.filter((c) => !foundCodes.includes(c));
      throw new BadRequestException(
        `Thuộc tính không tồn tại: ${missing.join(', ')}`,
      );
    }

    for (const dbAttr of dbAttributes) {
      if (
        dbAttr.display_type === AttributeType.BUTTON ||
        dbAttr.display_type === AttributeType.TEXT ||
        dbAttr.display_type === AttributeType.COLOR_SWATCH
      ) {
        const inputValues = inputAttributes.get(dbAttr.code);

        const validValuesLower = dbAttr.values.map((v) =>
          v.value.toLowerCase(),
        );

        if (inputValues) {
          inputValues.forEach((iv) => {
            if (!validValuesLower.includes(iv.toLowerCase())) {
              throw new BadRequestException(
                `Giá trị '${iv}' không hợp lệ cho thuộc tính '${dbAttr.name}'`,
              );
            }
          });
        }
      }
    }
  }

  private flattenAttributes(variants: VariantInput[]): unknown[] {
    if (!variants || variants.length === 0) return [];

    const attrMap = new Map<string, unknown>();

    variants.forEach((variant) => {
      if (variant.attributes) {
        variant.attributes.forEach((attr) => {
          const key = `${attr.code}_${attr.value}`;
          if (!attrMap.has(key)) {
            attrMap.set(key, {
              code: attr.code,
              value: attr.value,
              unit: attr.unit,
            });
          }
        });
      }
    });

    return Array.from(attrMap.values());
  }

  private createSlug(name: string): string {
    return defaultSlugify(name, { lower: true, strict: true, locale: 'vi' });
  }

  private async checkSkuExists(sku: string, excludeId?: string): Promise<void> {
    const query: FilterQuery<ProductDocument> = {
      $or: [{ sku: sku }, { 'variants.sku': sku }],
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await this.productModel.findOne(query).select('_id').lean();
    if (exists) {
      throw new ConflictException(
        `Mã SKU '${sku}' đã tồn tại (Có thể nằm trong sản phẩm đã xóa hoặc ẩn)`,
      );
    }
  }

  private calculateSpecs(variants: VariantInput[]): ProductAttributeParams[] {
    if (!variants || variants.length === 0) return [];
    const map = new Map<string, Set<string>>();

    variants.forEach((variant) => {
      if (variant.attributes) {
        variant.attributes.forEach((attr) => {
          if (!map.has(attr.code)) {
            map.set(attr.code, new Set());
          }
          const valuesSet = map.get(attr.code);
          if (valuesSet) {
            valuesSet.add(attr.value);
          }
        });
      }
    });

    const specs: ProductAttributeParams[] = [];
    map.forEach((valuesSet, key) => {
      specs.push({
        name: key,
        values: Array.from(valuesSet),
      });
    });
    return specs;
  }

  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img',
        'h1',
        'h2',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
      },
    });
  }

  async create(
    createProductDto: CreateProductDto,
    userId: string,
    userRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    // 1. Kiểm tra SKU cha đã tồn tại chưa
    const isExist = await this.productModel.exists({
      sku: createProductDto.sku,
    });
    if (isExist) {
      throw new ConflictException(
        `Mã SKU '${createProductDto.sku}' đã tồn tại trên hệ thống!`,
      );
    }

    const variants = createProductDto.variants || [];

    // 2. Xử lý và Validate Biến thể (Variants)
    if (variants.length > 0) {
      const variantSkus = variants.map((v) => v.sku);
      if (new Set(variantSkus).size !== variantSkus.length) {
        throw new BadRequestException(
          'Danh sách biến thể có chứa các SKU trùng nhau',
        );
      }

      const firstVariantAttrs = variants[0].attributes;
      if (firstVariantAttrs.length > 3) {
        throw new BadRequestException(
          'Hệ thống chỉ hỗ trợ tối đa 3 nhóm thuộc tính phân loại',
        );
      }

      const standardKeys = firstVariantAttrs
        .map((a) => a.code)
        .sort()
        .join(',');

      for (const variant of variants) {
        const currentKeys = variant.attributes
          .map((a) => a.code)
          .sort()
          .join(',');
        if (currentKeys !== standardKeys) {
          throw new BadRequestException(
            `Lỗi cấu trúc biến thể (SKU: ${variant.sku}): Các biến thể phải có cùng nhóm thuộc tính.`,
          );
        }

        // Kiểm tra SKU biến thể đã tồn tại chưa
        const isVarExist = await this.productModel.exists({
          $or: [{ sku: variant.sku }, { 'variants.sku': variant.sku }],
        });
        if (isVarExist) {
          throw new ConflictException(
            `SKU biến thể '${variant.sku}' đã tồn tại trên hệ thống.`,
          );
        }

        // Khởi tạo mặc định số lượng và giá khi tạo mới từ Product Management
        variant.stock = variant.stock || 0;
        variant.price = 0;
        variant.sale_price = 0;
        variant.active = false;
      }
    }

    // 3. Xử lý giá của sản phẩm cha
    if (!createProductDto.sale_price || createProductDto.sale_price === 0) {
      createProductDto.sale_price = createProductDto.price || 0;
    }

    // 4. Xử lý Specs và Attributes từ Variants
    const specs = this.calculateSpecs(variants);
    const flatAttributes = this.flattenAttributes(variants);

    // 5. Làm sạch Description chống XSS
    let cleanDescription = createProductDto.description;
    if (cleanDescription) {
      cleanDescription = this.sanitizeContent(cleanDescription);
    }

    // 6. Xử lý Slug cho Product
    const slug =
      createProductDto.slug || this.createSlug(createProductDto.name);
    const slugExists = await this.productModel.exists({ slug });
    if (slugExists) {
      throw new ConflictException('Đường dẫn (Slug) đã tồn tại');
    }

    // 7. Xử lý Tags (Dành cho thuật toán AI và Search Engine)
    const cleanTags = createProductDto.tags || [];
    if (cleanTags.length === 0) cleanTags.push('uncategorized');

    // 8. Khởi tạo trực tiếp Document mới thay vì cập nhật Stub
    const newProduct = new this.productModel({
      name: createProductDto.name,
      sku: createProductDto.sku,
      slug: slug,
      description: cleanDescription,
      categories: createProductDto.category_ids.map(
        (id) => new Types.ObjectId(id),
      ),
      tags: cleanTags,
      status: ProductStatus.DRAFT, // Sản phẩm mới luôn tạo ở trạng thái DRAFT
      has_variants: variants.length > 0,
      specs,
      attributes: flatAttributes,
      created_by: new Types.ObjectId(userId),
      price: 0,
      sale_price: 0,
      variants: variants,
      weight: createProductDto.weight ?? 0.5,
      stock: createProductDto.stock || 0, // Gán số lượng mặc định từ DTO (nếu có) hoặc 0
    });

    // 9. Lưu vào Cơ sở dữ liệu
    await newProduct.save();

    // 10. Ghi nhận nhật ký hệ thống (Audit Log)
    await this.auditLogsService.log({
      action: 'CREATE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: newProduct._id.toString(),
      department: Department.WAREHOUSE, // Hoặc Department tương ứng với Product
      detail: {
        sku: newProduct.sku,
        name: newProduct.name,
        is_price_reset: true,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return newProduct;
  }

  async findAll(query: ProductQueryParam) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { keyword, category_id, status, sort = 'newest' } = query;

    const filter: FilterQuery<ProductDocument> = {
      is_deleted: false,
    };

    if (status) filter.status = status;

    if (category_id) {
      if (Types.ObjectId.isValid(category_id)) {
        filter.categories = new Types.ObjectId(category_id);
      } else {
        filter.categories = new Types.ObjectId();
      }
    }

    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
      const cleanKeyword = keyword.trim();
      filter.$or = [
        { name: { $regex: cleanKeyword, $options: 'i' } },
        { sku: { $regex: cleanKeyword, $options: 'i' } },
      ];
    }

    let sortOption: Record<string, 1 | -1> = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };

    const selectFields =
      'name sku price sale_price thumbnail slug categories status stock rating_average created_at has_variants variants price_request';

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .select(selectFields)
        .populate('categories', 'name slug')
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPendingPriceRequests(query: ProductQueryParam) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      pending_price_change: { $ne: null },
      is_deleted: false,
    };

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .select('name sku price sale_price pending_price_change thumbnail')
        .populate('pending_price_change.requester_id', 'name email')
        .sort({ 'pending_price_change.requested_at': -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');
    const product = await this.productModel
      .findOne({ _id: id, is_deleted: false })
      .populate('categories', 'name slug')
      .lean();
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    if (product.gallery && product.gallery.length > 0) {
      product.gallery.sort((a, b) => a.display_order - b.display_order);
    }
    return product;
  }

  async findRelated(id: string, limit: number = 5) {
    const product = await this.productModel
      .findById(id)
      .select('categories price');
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const relatedProducts = await this.productModel
      .find({
        _id: { $ne: product._id },
        categories: { $in: product.categories },
        status: ProductStatus.ACTIVE,
        is_deleted: false,
        price: { $lt: product.price * 0.5 },
      })
      .select('name sku price sale_price thumbnail slug rating_average')
      .limit(limit)
      .lean();

    if (relatedProducts.length === 0) {
      return this.productModel
        .find({
          _id: { $ne: product._id },
          status: ProductStatus.ACTIVE,
          is_deleted: false,
        })
        .sort({ created_at: -1 })
        .select('name sku price sale_price thumbnail slug rating_average')
        .limit(limit)
        .lean();
    }

    return relatedProducts;
  }

  async findBySlug(slug: string, userId?: string) {
    let product: Product | null = null;

    if (Types.ObjectId.isValid(slug)) {
      product = (await this.productModel
        .findOne({ _id: slug, status: ProductStatus.ACTIVE, is_deleted: false })
        .populate('categories', 'name slug')
        .lean()
        .exec()) as unknown as Product;
    }

    if (!product) {
      product = (await this.productModel
        .findOne({ slug, status: ProductStatus.ACTIVE, is_deleted: false })
        .populate('categories', 'name slug')
        .lean()
        .exec()) as unknown as Product;
    }

    if (!product) {
      const oldProduct = await this.productModel
        .findOne({ old_slugs: slug })
        .select('slug')
        .lean();
      if (oldProduct) {
        throw new HttpException(
          { message: 'Sản phẩm đã đổi đường dẫn', new_slug: oldProduct.slug },
          HttpStatus.MOVED_PERMANENTLY,
        );
      }
      throw new NotFoundException('Sản phẩm không tìm thấy');
    }

    // [FIX 2 Client]: Cắt bỏ các biến thể chưa duyệt giá (active = false) trước khi trả về Storefront
    if (product.has_variants && product.variants) {
      const activeVariants = product.variants.filter(
        (v) => v.active === true || v.price > 0,
      );
      product.variants = activeVariants;

      // Đồng thời cắt bỏ luôn nút bấm Tùy chọn (Color/Size) nếu nó không thuộc về bất kỳ biến thể nào đang active
      const activeAttrSet = new Set<string>();
      activeVariants.forEach((v) => {
        v.attributes.forEach((attr) => {
          activeAttrSet.add(`${attr.code}_${attr.value}`);
        });
      });

      product.attributes = product.attributes.filter((attr) =>
        activeAttrSet.has(`${attr.code}_${attr.value}`),
      );
    }

    let estimatedPoints = 0;
    let memberDiscountApplied = false;
    let finalSalePrice = product.sale_price || product.price;

    if (userId) {
      const customer = await this.customerModel
        .findById(userId)
        .select('loyalty')
        .lean()
        .exec();
      const userTierCode = customer?.loyalty?.tier || 'SILVER';

      const tierConfig = (await this.tierModel
        .findOne({ code: userTierCode })
        .lean()
        .exec()) as MemberTierDocument | null;

      if (tierConfig) {
        interface ExtendedProductData {
          rank_required?: number;
          is_member_only?: boolean;
          member_prices?: Record<string, number>;
        }

        interface ExtendedTierData {
          rank_level?: number;
          upgrade_reward?: {
            is_active: boolean;
            discount_value: number;
          };
        }

        const prodData = product as unknown as ExtendedProductData;
        const tierData = tierConfig as unknown as ExtendedTierData;

        const userRank = tierData.rank_level ?? 0;
        const requiredRank = prodData.rank_required ?? 0;

        if (prodData.is_member_only && userRank < requiredRank) {
          throw new BadRequestException(
            'Sản phẩm này chỉ dành cho thành viên hạng cao mua sớm.',
          );
        }

        if (prodData.member_prices && prodData.member_prices[userTierCode]) {
          finalSalePrice = prodData.member_prices[userTierCode];
          memberDiscountApplied = true;
        } else {
          const upgradeReward = tierData.upgrade_reward;
          if (
            upgradeReward?.is_active &&
            (upgradeReward.discount_value ?? 0) > 0
          ) {
            finalSalePrice =
              finalSalePrice * (1 - upgradeReward.discount_value / 100);
            memberDiscountApplied = true;
          }
        }
      }

      const pointResult = await this.loyaltyService.estimateCheckoutPoints(
        userId,
        finalSalePrice,
      );
      estimatedPoints = pointResult.data?.earnedPoints || 0;
    }

    return {
      ...product,
      sale_price: Math.floor(finalSalePrice),
      estimated_points: estimatedPoints,
      is_member_pricing: memberDiscountApplied,
    };
  }

  async update(
    id: string,
    updateDto: UpdateProductDto,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // Kiểm tra chặn thao tác nếu có đơn hàng đang chạy
    const hasActiveOrder = await this.orderModel.exists({
      'items.product_id': new Types.ObjectId(id),
      status: { $in: this.ONGOING_ORDER_STATUSES },
    });

    if (hasActiveOrder) {
      if (updateDto.sku && updateDto.sku !== product.sku) {
        throw new BadRequestException(
          'Sản phẩm đang có đơn hàng ĐANG XỬ LÝ. KHÔNG ĐƯỢC PHÉP thay đổi mã SKU gốc.',
        );
      }

      if (updateDto.variants) {
        const newSkus = updateDto.variants.map((v) => v.sku);
        const missingOldVariant = product.variants.find(
          (v) => !newSkus.includes(v.sku),
        );
        if (missingOldVariant) {
          throw new BadRequestException(
            `Sản phẩm đang có đơn hàng chưa giao xong. KHÔNG ĐƯỢC XÓA BIẾN THỂ [${missingOldVariant.sku}]. Hãy Tắt (Inactive) biến thể đó thay vì Xóa!`,
          );
        }
      }
    }

    if (product.status === ProductStatus.ACTIVE) {
      throw new BadRequestException(
        'Sản phẩm đang BẬT BÁN (Active). Vui lòng Tắt hoạt động (Inactive) trước khi chỉnh sửa thông tin.',
      );
    }

    delete updateDto['price'];
    delete updateDto['sale_price'];
    delete updateDto['status'];
    delete updateDto['pending_price_change'];

    if (updateDto.sku && updateDto.sku !== product.sku) {
      await this.checkSkuExists(updateDto.sku, id);
    }

    if (updateDto.slug && updateDto.slug !== product.slug) {
      const exists = await this.productModel.exists({
        slug: updateDto.slug,
        _id: { $ne: id },
      });
      if (exists) throw new ConflictException('Slug đã trùng');
      if (!product.old_slugs) product.old_slugs = [];
      product.old_slugs.push(product.slug);
      product.slug = updateDto.slug;
    } else if (
      updateDto.name &&
      updateDto.name !== product.name &&
      !updateDto.slug
    ) {
      const newSlug = this.createSlug(updateDto.name);
      if (newSlug !== product.slug) {
        const exists = await this.productModel.exists({
          slug: newSlug,
          _id: { $ne: id },
        });
        if (!exists) {
          if (!product.old_slugs) product.old_slugs = [];
          product.old_slugs.push(product.slug);
          product.slug = newSlug;
        }
      }
    }

    if (updateDto.name && updateDto.name !== product.name) {
      const nameExists = await this.productModel.exists({
        name: updateDto.name,
        _id: { $ne: id },
      });
      if (nameExists) throw new ConflictException('Tên sản phẩm đã tồn tại');
    }

    if (updateDto.variants) {
      await this.validateAttributesExist(updateDto.variants);
      product.has_variants = updateDto.variants.length > 0;
      product.specs = this.calculateSpecs(updateDto.variants);

      const oldVariants = product.variants || [];
      const newSkus = updateDto.variants.map((newVar) => newVar.sku);
      const deletedVariants = oldVariants.filter(
        (oldV) => !newSkus.includes(oldV.sku),
      );

      // Xử lý dọn dẹp phương tiện cho biến thể bị xóa với cơ chế xử lý đồng bộ
      if (deletedVariants.length > 0) {
        const deleteMediaPromises = deletedVariants.map((deletedVar) =>
          this.mediaService.deleteMediaByTarget(deletedVar.sku, 'Variant'),
        );

        const deleteResults = await Promise.allSettled(deleteMediaPromises);

        deleteResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            const sku = deletedVariants[index].sku;
            console.error(
              `Lỗi dọn dẹp phương tiện cho biến thể bị xóa ${sku}:`,
              result.reason instanceof Error
                ? result.reason.stack
                : String(result.reason),
            );
          }
        });
      }

      const oldVariantsMap = new Map(oldVariants.map((v) => [v.sku, v]));

      const variantsToHide: string[] = [];
      const variantsToPublish: string[] = [];

      updateDto.variants = updateDto.variants.map((newVar) => {
        const oldVar = oldVariantsMap.get(newVar.sku);

        // KHẮC PHỤC LỖI ESLINT: Dùng Intersection Type (&) thay vì 'any'
        // Ép kiểu an toàn để TS hiểu biến này có chứa các trường của Tồn kho và Trạng thái
        const safeVar = newVar as typeof newVar & {
          stock: number;
          stock_on_hold: number;
          min_stock: number;
          max_stock: number;
          active: boolean;
          images: string[];
        };

        if (oldVar) {
          safeVar.price = oldVar.price;
          safeVar.sale_price = oldVar.sale_price;

          // Bảo toàn dữ liệu tồn kho cũ
          safeVar.stock = oldVar.stock;
          safeVar.stock_on_hold = oldVar.stock_on_hold;
          safeVar.min_stock = oldVar.min_stock;
          safeVar.max_stock = oldVar.max_stock;
        } else {
          safeVar.price = 0;
          safeVar.sale_price = 0;

          // Khởi tạo mặc định cho biến thể mới
          safeVar.stock = 0;
          safeVar.stock_on_hold = 0;
          safeVar.min_stock = 0;
          safeVar.max_stock = 0;
        }

        const currentPrice = safeVar.price;

        if (currentPrice <= 0) {
          safeVar.active = false;
        } else if (oldVar) {
          safeVar.active = oldVar.active;
        } else {
          safeVar.active = true;
        }

        // Bắt sự kiện đổi trạng thái hoạt động của biến thể để đồng bộ ẩn/hiện hình ảnh
        if (oldVar && oldVar.active !== safeVar.active) {
          if (safeVar.active === false) {
            variantsToHide.push(safeVar.sku);
          } else {
            variantsToPublish.push(safeVar.sku);
          }
        }

        if (oldVar && oldVar.images && oldVar.images.length > 0) {
          return { ...safeVar, images: oldVar.images };
        }

        return safeVar;
      });

      // Thực thi đồng bộ Media cho các biến thể bị đổi trạng thái mà không bị xóa
      if (variantsToHide.length > 0) {
        const hidePromises = variantsToHide.map((sku) =>
          this.mediaService.bulkUpdateStatusByTarget(sku, 'Hidden'),
        );
        const hideResults = await Promise.allSettled(hidePromises);
        hideResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(
              `Lỗi ẩn Media cho biến thể SKU ${variantsToHide[index]}:`,
              result.reason instanceof Error
                ? result.reason.stack
                : String(result.reason),
            );
          }
        });
      }

      if (variantsToPublish.length > 0) {
        const publishPromises = variantsToPublish.map((sku) =>
          this.mediaService.bulkUpdateStatusByTarget(sku, 'Published'),
        );
        const publishResults = await Promise.allSettled(publishPromises);
        publishResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(
              `Lỗi mở khóa Media cho biến thể SKU ${variantsToPublish[index]}:`,
              result.reason instanceof Error
                ? result.reason.stack
                : String(result.reason),
            );
          }
        });
      }

      product.attributes = this.flattenAttributes(
        updateDto.variants,
      ) as unknown as ProductAttribute[];
    }

    if (updateDto.category_ids) {
      if (updateDto.category_ids.length === 0)
        throw new BadRequestException('Cần ít nhất 1 danh mục');

      const categoryIds = updateDto.category_ids.map(
        (cid) => new Types.ObjectId(cid),
      );
      product.categories = categoryIds as unknown as typeof product.categories;
      delete updateDto.category_ids;
    }

    if (updateDto.description) {
      updateDto.description = this.sanitizeContent(updateDto.description);
    }

    Object.assign(product, updateDto);
    delete updateDto.slug;
    await product.save();

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_INFO',
      collection_name: 'products',
      actor_id: userId,
      target_id: product._id,
      department: Department.WAREHOUSE,
      detail: { changes: updateDto },
      ip: ip,
      user_agent: userAgent,
    });
    return product;
  }

  async updateStatus(
    id: string,
    statusDto: UpdateProductStatusDto,
    userId: string,
    userRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    const { status } = statusDto;

    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const oldStatus = product.status;

    if (oldStatus === status) {
      return product;
    }

    if (status === ProductStatus.ACTIVE) {
      if (
        product.price_request &&
        product.price_request.status === PriceRequestStatus.PENDING
      ) {
        throw new BadRequestException(
          'Sản phẩm đang có yêu cầu thay đổi giá chờ phê duyệt. Vui lòng xử lý yêu cầu giá trước khi kích hoạt lại!',
        );
      }

      if (!product.has_variants) {
        if (product.price <= 0) {
          throw new BadRequestException(
            'Sản phẩm này chưa từng được duyệt giá bán (Giá gốc = 0). Vui lòng cập nhật và duyệt giá thành công trước khi kích hoạt bán!',
          );
        }

        if ((product.stock ?? 0) <= 0) {
          throw new BadRequestException(
            'Sản phẩm chưa được nhập kho (Số lượng = 0). Vui lòng nhập kho để có thể kích hoạt bán!',
          );
        }
      } else {
        const hasValidVariantToActive = product.variants.some(
          (v) => (v.price ?? 0) > 0 && (v.stock ?? 0) > 0,
        );

        if (!hasValidVariantToActive) {
          throw new BadRequestException(
            'Sản phẩm không có biến thể nào đủ điều kiện bán. Cần ít nhất 1 biến thể thỏa mãn cả 2 điều kiện: Đã duyệt giá (>0) và Đã nhập kho (>0)!',
          );
        }

        let isModified = false;

        product.variants.forEach((v) => {
          // quy chuẩn hóa giá trị về 0 nếu dữ liệu trong cơ sở dữ liệu bị khuyết
          const currentPrice = v.price ?? 0;
          const currentStock = v.stock ?? 0;

          // tự động tắt biến thể nếu không đáp ứng đủ cả hai điều kiện bắt buộc
          if ((currentPrice <= 0 || currentStock <= 0) && v.active !== false) {
            v.active = false;
            isModified = true;
          }
          // tự động mở lại biến thể khi các chỉ số đều hợp lệ
          else if (currentPrice > 0 && currentStock > 0 && v.active === false) {
            v.active = true;
            isModified = true;
          }
        });

        if (isModified) {
          product.markModified('variants');
        }
      }

      if (
        !product.thumbnail &&
        (!product.images || product.images.length === 0)
      ) {
        throw new BadRequestException(
          'Sản phẩm chưa có hình ảnh đại diện hoặc thư viện ảnh. Không thể bật hoạt động bán!',
        );
      }

      if (!product.categories || product.categories.length === 0) {
        throw new BadRequestException(
          'Sản phẩm chưa được gán vào bất kỳ Danh mục nào. Không thể bật hoạt động bán!',
        );
      }

      if (!product.tags || product.tags.length === 0) {
        throw new BadRequestException(
          'Sản phẩm chưa có thẻ từ khóa (Tags). Hệ thống phân tích cần ít nhất 1 Tag!',
        );
      }
    }

    product.status = status;
    await product.save();

    if (status === ProductStatus.ACTIVE) {
      this.syncToSearchEngine(product).catch((err: unknown) => {
        console.error(
          'Lỗi đồng bộ dữ liệu lên hệ thống tìm kiếm Algolia:',
          err instanceof Error ? err.stack : String(err),
        );
      });

      this.mediaService
        .bulkUpdateStatusByTarget(product._id.toString(), 'Published')
        .catch((err: unknown) => {
          console.error(
            'Lỗi tự động mở khóa (Publish) media:',
            err instanceof Error ? err.stack : String(err),
          );
        });

      // Mở khóa phương tiện biến thể song song với cơ chế an toàn
      const variantMediaPromises = product.variants.map((variant) =>
        this.mediaService.bulkUpdateStatusByTarget(variant.sku, 'Published'),
      );

      const syncResults = await Promise.allSettled(variantMediaPromises);

      syncResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const sku = product.variants[index].sku;
          console.error(
            `Lỗi đồng bộ trạng thái phương tiện cho biến thể ${sku}:`,
            result.reason instanceof Error
              ? result.reason.stack
              : String(result.reason),
          );
        }
      });
    } else if (
      status === ProductStatus.DRAFT ||
      status === ProductStatus.INACTIVE
    ) {
      this.algoliaService
        .removeProduct(product._id.toString())
        .catch((err: unknown) => {
          console.error(
            'Lỗi xóa sản phẩm khỏi hệ thống tìm kiếm Algolia:',
            err instanceof Error ? err.stack : String(err),
          );
        });

      this.mediaService
        .bulkUpdateStatusByTarget(product._id.toString(), 'Hidden')
        .catch((err: unknown) => {
          console.error(
            'Lỗi tự động ẩn tệp tin truyền thông liên quan:',
            err instanceof Error ? err.stack : String(err),
          );
        });

      // Ẩn phương tiện biến thể song song với cơ chế an toàn
      const variantMediaPromises = product.variants.map((variant) =>
        this.mediaService.bulkUpdateStatusByTarget(variant.sku, 'Hidden'),
      );

      const syncResults = await Promise.allSettled(variantMediaPromises);

      syncResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const sku = product.variants[index].sku;
          console.error(
            `Lỗi ẩn trạng thái phương tiện cho biến thể ${sku}:`,
            result.reason instanceof Error
              ? result.reason.stack
              : String(result.reason),
          );
        }
      });
    }

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_STATUS',
      collection_name: 'products',
      actor_id: userId,
      target_id: product._id.toString(),
      department: Department.WAREHOUSE,
      detail: {
        sku: product.sku,
        old_status: oldStatus,
        new_status: status,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return product;
  }

  async requestPriceUpdate(
    id: string,
    dto: UpdateProductPriceDto,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const hasActiveOrder = await this.orderModel.exists({
      'items.product_id': new Types.ObjectId(id),
      status: { $in: this.ONGOING_ORDER_STATUSES },
    });

    if (hasActiveOrder) {
      if (
        !product.has_variants &&
        product.price > 0 &&
        dto.price !== undefined &&
        dto.price !== product.price
      ) {
        throw new BadRequestException(
          'Sản phẩm đang có đơn hàng hoạt động. Phần Giá Gốc (đã duyệt) BỊ KHÓA, không được phép chỉnh sửa.',
        );
      }
      if (product.has_variants && dto.variants) {
        for (const v of dto.variants) {
          const existingVar = product.variants.find((ex) => ex.sku === v.sku);
          if (
            existingVar &&
            existingVar.price > 0 &&
            v.price !== undefined &&
            v.price !== existingVar.price
          ) {
            throw new BadRequestException(
              `Biến thể [${v.sku}] đang có đơn hàng và đã được duyệt giá, phần giá này BỊ KHÓA. Bạn chỉ có thể duyệt giá cho biến thể mới.`,
            );
          }
        }
      }
    }

    const currentRequest = product.price_request;
    if (
      currentRequest &&
      currentRequest.status === PriceRequestStatus.PENDING
    ) {
      throw new BadRequestException(
        'Không thể sửa yêu cầu giá đang chờ duyệt.',
      );
    }

    const effectiveDate = new Date(dto.effective_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveDate < today) {
      throw new BadRequestException(
        'Ngày áp dụng không được nằm trong quá khứ.',
      );
    }

    const existingVariants = currentRequest?.variants || [];
    const newVariants = dto.variants
      ? dto.variants.map((v) => ({
          sku: v.sku,
          price: v.price,
          sale_price: 0,
          status: PriceRequestStatus.DRAFT,
        }))
      : [];

    const mergedVariants = [...existingVariants];
    newVariants.forEach((nv) => {
      const idx = mergedVariants.findIndex((ev) => ev.sku === nv.sku);
      if (idx !== -1) {
        mergedVariants[idx].price = nv.price;
        mergedVariants[idx].status = PriceRequestStatus.DRAFT;
      } else {
        mergedVariants.push(nv);
      }
    });

    product.price_request = {
      price: dto.price,
      currency: dto.currency || currentRequest?.currency || 'VND',
      variants: mergedVariants,
      effective_date: effectiveDate,
      status: PriceRequestStatus.DRAFT,
      requester_id: new Types.ObjectId(userId),
      requested_at: new Date(),
    } as PriceRequest;

    await product.save();

    await this.auditLogsService.log({
      action: 'REQUEST_PRICE_UPDATE',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: { new_price: dto.price, effective_date: effectiveDate },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã lưu nháp yêu cầu giá thành công' };
  }

  async submitPriceRequest(
    id: string,
    sku: string | undefined,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product || !product.price_request) {
      throw new NotFoundException('Không tìm thấy yêu cầu giá');
    }

    if (
      sku &&
      product.price_request.variants &&
      product.price_request.variants.length > 0
    ) {
      const variantIndex = product.price_request.variants.findIndex(
        (v) => v.sku === sku,
      );
      if (variantIndex === -1) {
        throw new NotFoundException(
          'Không tìm thấy biến thể trong yêu cầu giá',
        );
      }

      if (
        product.price_request.variants[variantIndex].status !==
        PriceRequestStatus.DRAFT
      ) {
        throw new BadRequestException(
          'Chỉ có thể Submit bản ghi ở trạng thái Draft',
        );
      }

      product.price_request.variants[variantIndex].status =
        PriceRequestStatus.PENDING;
    } else {
      if (product.price_request.status !== PriceRequestStatus.DRAFT) {
        throw new BadRequestException(
          'Chỉ có thể Submit bản ghi ở trạng thái Draft',
        );
      }
      product.price_request.status = PriceRequestStatus.PENDING;
    }

    await product.save();

    await this.auditLogsService.log({
      action: 'SUBMIT_PRICE_REQUEST',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: {
        message: `Đẩy yêu cầu nháp lên chờ phê duyệt cho ${sku || 'sản phẩm'}`,
      },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã đẩy yêu cầu lên chờ phê duyệt' };
  }

  async approvePriceChange(
    id: string,
    sku: string | undefined,
    isApproved: boolean,
    userId: string,
    ip: string,
    userAgent: string,
    reason?: string,
  ) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product || !product.price_request) {
      throw new NotFoundException('Không có yêu cầu giá');
    }

    const newStatus = isApproved
      ? PriceRequestStatus.APPROVED
      : PriceRequestStatus.REJECTED;
    let oldPrice = product.price;
    let newPrice = product.price_request.price;

    if (
      sku &&
      product.price_request.variants &&
      product.price_request.variants.length > 0
    ) {
      const variantIndex = product.price_request.variants.findIndex(
        (v) => v.sku === sku,
      );
      if (variantIndex === -1) {
        throw new NotFoundException('Không tìm thấy biến thể');
      }

      if (
        product.price_request.variants[variantIndex].status !==
        PriceRequestStatus.PENDING
      ) {
        throw new BadRequestException(
          'Biến thể này không ở trạng thái chờ duyệt (Pending)',
        );
      }

      product.price_request.variants[variantIndex].status = newStatus;
      newPrice = product.price_request.variants[variantIndex].price;

      if (isApproved) {
        const productVariantIndex = product.variants.findIndex(
          (v) => v.sku === sku,
        );
        if (productVariantIndex !== -1) {
          oldPrice = product.variants[productVariantIndex].price;
          product.variants[productVariantIndex].price = newPrice;
        }
      }
    } else {
      if (product.price_request.status !== PriceRequestStatus.PENDING) {
        throw new BadRequestException(
          'Sản phẩm không ở trạng thái chờ duyệt (Pending)',
        );
      }
      product.price_request.status = newStatus;
      if (isApproved) {
        product.price = newPrice;
        product.currency = product.price_request.currency;
      }
      if (!isApproved && reason) {
        product.price_request.reject_reason = reason;
      }
    }

    product.price_request.approver_id = new Types.ObjectId(userId);

    if (
      product.price_request.variants &&
      product.price_request.variants.length > 0
    ) {
      const allProcessed = product.price_request.variants.every(
        (v) =>
          v.status === PriceRequestStatus.APPROVED ||
          v.status === PriceRequestStatus.REJECTED,
      );
      if (allProcessed) {
        const allApproved = product.price_request.variants.every(
          (v) => v.status === PriceRequestStatus.APPROVED,
        );
        product.price_request.status = allApproved
          ? PriceRequestStatus.APPROVED
          : PriceRequestStatus.REJECTED;
      }
    }

    await product.save();

    await this.auditLogsService.log({
      action: isApproved ? 'APPROVE_PRICE' : 'REJECT_PRICE',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: {
        sku: sku || product.sku,
        result: newStatus,
        old_price: oldPrice,
        new_price: newPrice,
        effective_date: product.price_request.effective_date,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: isApproved ? 'Đã duyệt yêu cầu giá' : 'Đã từ chối yêu cầu giá',
    };
  }

  async bulkApprovePriceChanges(
    items: { product_id: string; sku: string }[],
    isApproved: boolean,
    reason: string,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    let successCount = 0;
    for (const item of items) {
      try {
        await this.approvePriceChange(
          item.product_id,
          item.sku,
          isApproved,
          userId,
          ip,
          userAgent,
          reason,
        );
        successCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Bulk action failed for product ${item.product_id} - SKU ${item.sku}:`,
          errorMessage,
        );
      }
    }
    return {
      message: `Đã xử lý thành công ${successCount}/${items.length} bản ghi.`,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async applyScheduledPrices() {
    const now = new Date();
    const products = await this.productModel.find({
      'price_request.status': PriceRequestStatus.APPROVED,
      'price_request.effective_date': { $lte: now },
      is_deleted: false,
    });

    for (const p of products) {
      const request = p.price_request;
      if (!request) continue;

      p.price = request.price;

      if (request.variants && request.variants.length > 0) {
        request.variants.forEach((reqVar) => {
          const vIndex = p.variants.findIndex((v) => v.sku === reqVar.sku);
          if (vIndex !== -1) p.variants[vIndex].price = reqVar.price;
        });
      }

      p.price_request = null;
      await p.save();
      console.log(`[CRON] Đã áp dụng giá mới tự động cho sản phẩm: ${p.sku}`);
    }
  }

  async remove(id: string, userId: string, ip: string, userAgent: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }

    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    if (product.status === ProductStatus.ACTIVE) {
      throw new BadRequestException(
        'Sản phẩm đang được BẬT BÁN (Active). Vui lòng tắt hoạt động trước khi thực hiện đưa vào thùng rác.',
      );
    }

    const hasActiveOrder = await this.orderModel.exists({
      'items.product_id': new Types.ObjectId(id),
      status: { $in: this.ONGOING_ORDER_STATUSES },
    });

    if (hasActiveOrder) {
      throw new BadRequestException(
        'Sản phẩm đang nằm trong đơn hàng hoạt động. KHÔNG ĐƯỢC PHÉP XÓA kể cả khi sản phẩm đã được tắt hoạt động (Inactive)!',
      );
    }

    product.is_deleted = true;
    product.status = ProductStatus.INACTIVE;
    await product.save();

    this.mediaService
      .bulkUpdateStatusByTarget(id, 'Hidden')
      .catch((err: unknown) => {
        console.error(
          'Lỗi tự động ẩn media khi soft delete:',
          err instanceof Error ? err.stack : String(err),
        );
      });

    // Ẩn phương tiện của các biến thể con một cách an toàn
    const variantMediaPromises = product.variants.map((variant) =>
      this.mediaService.bulkUpdateStatusByTarget(variant.sku, 'Hidden'),
    );

    const syncResults = await Promise.allSettled(variantMediaPromises);

    syncResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const sku = product.variants[index].sku;
        console.error(
          `Lỗi đồng bộ ẩn phương tiện cho biến thể khi xóa sản phẩm ${sku}:`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });

    try {
      await this.algoliaService.removeProduct(id);
      console.log(`[Algolia] Đã gỡ sản phẩm ${id} do bị xóa.`);
    } catch (err: unknown) {
      console.error(
        'Lỗi xóa Algolia khi Soft Delete:',
        err instanceof Error ? err.stack : String(err),
      );
    }

    await this.auditLogsService.log({
      action: 'SOFT_DELETE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: {
        product_name: product.name,
        sku: product.sku,
        deleted_at: new Date(),
      },
      ip: ip,
      user_agent: userAgent,
    });

    return { message: 'Đã đưa sản phẩm vào thùng rác thành công.' };
  }

  async updateTags(
    id: string,
    tags: string[],
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    const isValid = await this.tagsService.validateTagsExist(tags);
    if (!isValid) {
      throw new BadRequestException(
        'Phát hiện thẻ không hợp lệ (không tồn tại trong hệ thống).',
      );
    }

    const oldTags = product.tags;
    product.tags = tags;
    await product.save();

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_TAGS',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: { old_tags: oldTags, new_tags: tags },
      ip: ip,
      user_agent: userAgent,
    });

    return product;
  }

  async bulkAddTags(
    productIds: string[],
    tagsToAdd: string[],
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const isValid = await this.tagsService.validateTagsExist(tagsToAdd);
    if (!isValid) throw new BadRequestException('Thẻ không tồn tại.');

    const result = await this.productModel.updateMany(
      { _id: { $in: productIds }, is_deleted: false },
      { $addToSet: { tags: { $each: tagsToAdd } } },
    );

    await this.auditLogsService.log({
      action: 'BULK_TAGGING',
      collection_name: 'products',
      actor_id: userId,
      target_id: null,
      department: Department.WAREHOUSE,
      detail: {
        products_affected: result.modifiedCount,
        tags_added: tagsToAdd,
        target_ids: productIds,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return {
      message: `Đã gắn thẻ thành công cho ${result.modifiedCount} sản phẩm`,
    };
  }

  async findByCategory(dto: FilterProductDto) {
    const { categorySlug, sort, attributes, keyword } = dto;
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const query: FilterQuery<ProductDocument> = {
      status: ProductStatus.ACTIVE,
      is_deleted: false,
    };

    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
      const cleanKeyword = keyword.trim();
      query.$or = [
        { name: { $regex: cleanKeyword, $options: 'i' } },
        { tags: { $regex: cleanKeyword, $options: 'i' } },
        { sku: { $regex: cleanKeyword, $options: 'i' } },
      ];
    }

    let category: ICategoryDoc | null = null;
    let subCategories: Partial<ICategoryDoc>[] = [];

    if (categorySlug && categorySlug !== 'all') {
      const foundCategory = await this.categoryModel
        .findOne({ slug: categorySlug })
        .lean<ICategoryDoc>();

      if (!foundCategory) throw new NotFoundException('Danh mục không tồn tại');

      category = foundCategory;

      const allCategories = await this.categoriesService.getAllChildCategories(
        category._id,
      );
      const categoryIds = [category._id, ...allCategories];
      query.categories = { $in: categoryIds };

      const subs = await this.categoryModel
        .find({ parent_id: category._id })
        .select('name slug image')
        .lean<ICategoryDoc[]>();

      subCategories = subs;
    }

    if (attributes) {
      const attributeFilters: FilterQuery<ProductDocument>[] = [];

      for (const [code, valuesStr] of Object.entries(attributes)) {
        if (!valuesStr) continue;

        const values = String(valuesStr)
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v);

        if (values.length > 0) {
          if (code === 'tags') {
            attributeFilters.push({ tags: { $in: values } });
          } else if (code === 'price') {
            if (values.length === 2) {
              attributeFilters.push({
                $expr: {
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
                },
              });
            }
          } else {
            attributeFilters.push({
              attributes: {
                $elemMatch: {
                  code: code,
                  value: { $in: values },
                },
              },
            });
          }
        }
      }

      if (attributeFilters.length > 0) {
        query.$and = attributeFilters;
      }
    }

    let sortOptions: { [key: string]: SortOrder } = {};
    switch (sort) {
      case SortOption.TRENDING:
      case SortOption.BEST_SELLER:
        sortOptions = { sold_count: -1, rating_average: -1, created_at: -1 };
        break;
      case SortOption.PRICE_ASC:
        sortOptions = { sale_price: 1, price: 1 };
        break;
      case SortOption.PRICE_DESC:
        sortOptions = { sale_price: -1, price: -1 };
        break;
      case SortOption.NEWEST:
      default:
        sortOptions = { created_at: -1 };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.productModel
        .find(query)
        .select(
          'name sku has_variants slug price sale_price sale_start_date sale_end_date thumbnail rating_average review_count sold_count stock created_at',
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(query),
    ]);

    const breadcrumbs = await this.buildBreadcrumbs(
      category ? (category as unknown as CategorySimple) : null,
    );

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
        sub_categories: subCategories,
        category: category
          ? {
              name: category.name,
              description: category.description || '',
              banner: category.image || '',
            }
          : { name: 'All Products', description: '', banner: '' },
        breadcrumbs: breadcrumbs,
      },
    };
  }

  private async buildBreadcrumbs(category: CategorySimple | null) {
    const crumbs: { name: string; slug: string }[] = [];
    let current = category;
    let currentDepth = 0;
    while (current && currentDepth < 10) {
      crumbs.unshift({ name: current.name, slug: current.slug });

      if (current.parent_id) {
        const parent = await this.categoryModel
          .findById(current.parent_id)
          .select('name slug parent_id')
          .lean();

        current = parent as CategorySimple | null;
      } else {
        current = null;
      }
      currentDepth++;
    }

    crumbs.unshift({ name: 'Trang chủ', slug: '' });
    return crumbs;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredSales() {
    const now = new Date();

    try {
      const result = await this.productModel.updateMany(
        {
          sale_end_date: { $lt: now },
          sale_price: { $gt: 0 },
          is_deleted: false,
        },
        {
          $set: {
            sale_price: 0,
            'variants.$[].sale_price': 0,
          },
        },
      );

      if (result.modifiedCount > 0) {
        console.log(
          `[CRON] Đã tự động tắt khuyến mãi cho ${result.modifiedCount} sản phẩm hết hạn.`,
        );
      }
    } catch (error) {
      console.error('[CRON] Lỗi khi xử lý giá khuyến mãi hết hạn:', error);
    }
  }

  async searchForChatbot(keyword: string) {
    console.log('\n--- N8N CHATBOT TÌM KIẾM SẢN PHẨM ---');
    console.log('1. Keyword gốc n8n gửi sang:', keyword);

    const safeKeyword = keyword.trim().replace(/\s+/g, '.*');
    const searchRegex = new RegExp(safeKeyword, 'i');
    console.log('2. Regex query trong DB:', searchRegex);

    const results = await this.productModel
      .find({
        $or: [
          { name: { $regex: searchRegex } },
          { tags: { $regex: searchRegex } },
        ],
        status: ProductStatus.ACTIVE,
        is_deleted: false,
      })
      .select('name slug price sale_price stock has_variants specs')
      .limit(5)
      .lean()
      .exec();

    console.log('3. Số sản phẩm DB trả về:', results.length);
    return results;
  }

  async bulkSyncToAlgolia() {
    console.log('Bắt đầu đồng bộ dữ liệu lên Algolia...');

    await this.algoliaService.clearAllProducts();

    const products = await this.productModel
      .find({ status: ProductStatus.ACTIVE, is_deleted: false })
      .exec();

    let count = 0;
    for (const product of products) {
      try {
        await this.syncToSearchEngine(product);
        count++;
      } catch (error) {
        console.error(`Lỗi đồng bộ SKU ${product.sku}:`, error);
      }
    }

    console.log(`Hoàn tất! Đã đẩy ${count} sản phẩm lên Algolia.`);
    return { message: `Đã đồng bộ thành công ${count} sản phẩm lên Algolia` };
  }

  async bulkUpdateStatus(
    productIds: string[],
    status: ProductStatus,
    userId: string,
    userRoles: string[],
    ip: string,
    userAgent: string,
  ) {
    let successCount = 0;
    for (const id of productIds) {
      try {
        await this.updateStatus(
          id,
          { status },
          userId,
          userRoles,
          ip,
          userAgent,
        );
        successCount++;
      } catch (error) {
        console.error(`Lỗi cập nhật trạng thái hàng loạt cho SP ${id}:`, error);
      }
    }
    return {
      message: `Đã cập nhật trạng thái thành công ${successCount}/${productIds.length} sản phẩm.`,
      successCount,
    };
  }

  async bulkRemove(
    productIds: string[],
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    let successCount = 0;
    for (const id of productIds) {
      try {
        await this.remove(id, userId, ip, userAgent);
        successCount++;
      } catch (error) {
        console.error(`Lỗi xóa hàng loạt cho SP ${id}:`, error);
      }
    }
    return {
      message: `Đã xóa thành công ${successCount}/${productIds.length} sản phẩm.`,
      successCount,
    };
  }

  async hardDeleteProduct(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // Dọn dẹp toàn bộ Media của Product mẹ (Hàm này đã bao gồm xóa Cloud + xóa DB)
    await this.mediaService.deleteMediaByTarget(id, 'Product');

    // Dọn dẹp toàn bộ Media của các Variant con trực thuộc
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        await this.mediaService.deleteMediaByTarget(variant.sku, 'Variant');
      }
    }

    // Cuối cùng tiến hành xóa sản phẩm khỏi MongoDB
    return this.productModel.findByIdAndDelete(id);
  }
}
