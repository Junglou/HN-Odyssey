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

interface PopulatedCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
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
  ) {}

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

    const categoryHierarchy: string[] = populatedProduct.categories.map(
      (c) => c.name,
    );

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
    await this.checkSkuExists(createProductDto.sku);

    const variants = createProductDto.variants || [];

    createProductDto.price = 0;
    createProductDto.sale_price = 0;

    if (variants.length > 0) {
      variants.forEach((v) => {
        v.price = 0;
        v.sale_price = 0;
      });
    }

    if (variants.length > 0) {
      const variantSkus = variants.map((v) => v.sku);
      if (new Set(variantSkus).size !== variantSkus.length) {
        throw new BadRequestException(
          'Danh sách biến thể có chứa SKU trùng nhau',
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
        await this.checkSkuExists(variant.sku);

        const currentKeys = variant.attributes
          .map((a) => a.code)
          .sort()
          .join(',');

        if (currentKeys !== standardKeys) {
          throw new BadRequestException(
            `Lỗi cấu trúc biến thể (SKU: ${variant.sku}): Các biến thể phải có cùng nhóm thuộc tính.`,
          );
        }
      }
    }

    if (!createProductDto.sale_price || createProductDto.sale_price === 0) {
      createProductDto.sale_price = createProductDto.price;
    }

    if (createProductDto.variants) {
      createProductDto.variants.forEach((v) => {
        if (!v.sale_price || v.sale_price === 0) {
          v.sale_price = v.price;
        }
      });
    }

    const slug =
      createProductDto.slug || this.createSlug(createProductDto.name);
    const slugExists = await this.productModel.exists({ slug });
    if (slugExists) throw new ConflictException('Đường dẫn (Slug) đã tồn tại');

    const specs = this.calculateSpecs(variants);
    const flatAttributes = this.flattenAttributes(variants);

    let cleanDescription = createProductDto.description;
    if (cleanDescription) {
      cleanDescription = this.sanitizeContent(cleanDescription);
    }

    const newProduct = new this.productModel({
      ...createProductDto,
      categories: createProductDto.category_ids.map(
        (id) => new Types.ObjectId(id),
      ),
      slug,
      status: ProductStatus.DRAFT,
      has_variants: variants.length > 0,
      specs,
      attributes: flatAttributes,
      created_by: new Types.ObjectId(userId),
      is_deleted: false,
      description: cleanDescription,
      price: createProductDto.price,
      sale_price: createProductDto.sale_price,
      variants: variants,
      weight: createProductDto.weight ?? 0.5,
    });

    await newProduct.save();

    await this.auditLogsService.log({
      action: 'CREATE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: newProduct._id,
      department: Department.WAREHOUSE,
      detail: {
        sku: newProduct.sku,
        name: newProduct.name,
        is_price_reset: true,
        initial_price: newProduct.price,
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
        { $text: { $search: cleanKeyword } },
        { sku: { $regex: cleanKeyword, $options: 'i' } },
      ];
    }

    let sortOption: Record<string, 1 | -1> = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };

    // Bổ sung price_request vào đây để giải quyết vấn đề
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
    const product = await this.productModel
      .findOne({ slug, status: ProductStatus.ACTIVE, is_deleted: false })
      .populate('categories', 'name slug')
      .lean()
      .exec();

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

    if (status === ProductStatus.ACTIVE) {
      if (
        product.price <= 0 &&
        (!product.variants || product.variants.length === 0)
      ) {
        throw new BadRequestException(
          'Sản phẩm chưa có giá bán (Giá = 0). Vui lòng cập nhật giá trước khi kích hoạt.',
        );
      }

      if (product.has_variants) {
        const validVariant = product.variants.some((v) => v.price > 0);
        if (!validVariant) {
          throw new BadRequestException(
            'Sản phẩm biến thể cần ít nhất 1 phiên bản có giá bán hợp lệ.',
          );
        }
      }

      if (
        !product.thumbnail &&
        (!product.images || product.images.length === 0)
      ) {
        throw new BadRequestException(
          'Sản phẩm chưa có hình ảnh. Không thể kích hoạt bán.',
        );
      }

      if (!product.categories || product.categories.length === 0) {
        throw new BadRequestException(
          'Sản phẩm chưa có Danh mục. Không thể kích hoạt.',
        );
      }

      if (!product.tags || product.tags.length === 0) {
        throw new BadRequestException(
          'Sản phẩm chưa có Tags từ khóa. Thuật toán AI cần ít nhất 1 Tag để hoạt động.',
        );
      }
    }

    product.status = status;
    await product.save();

    if (status === ProductStatus.ACTIVE) {
      this.syncToSearchEngine(product).catch((err) => {
        console.error('Lỗi đồng bộ Algolia:', err);
      });
    } else if (
      status === ProductStatus.DRAFT ||
      status === ProductStatus.INACTIVE
    ) {
      this.algoliaService.removeProduct(product._id.toString()).catch((err) => {
        console.error('Lỗi xóa Algolia:', err);
      });

      this.mediaService
        .bulkUpdateStatusByTarget(product._id.toString(), 'Hidden')
        .catch((err) => {
          console.error('Lỗi tự động ẩn media:', err);
        });
    }

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_STATUS',
      collection_name: 'products',
      actor_id: userId,
      target_id: product._id,
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

    const currentRequest = product.price_request;
    if (
      currentRequest &&
      (currentRequest.status === PriceRequestStatus.PENDING ||
        currentRequest.status === PriceRequestStatus.APPROVED)
    ) {
      throw new BadRequestException(
        'Không thể sửa yêu cầu giá đang chờ duyệt hoặc đã được duyệt.',
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

    // Merge các variant cũ trong request với variant mới gửi lên để đảm bảo không bị đè mất dữ liệu
    const existingVariants = currentRequest?.variants || [];
    const newVariants = dto.variants
      ? dto.variants.map((v) => ({ sku: v.sku, price: v.price, sale_price: 0 }))
      : [];

    const mergedVariants = [...existingVariants];
    newVariants.forEach((nv) => {
      const idx = mergedVariants.findIndex((ev) => ev.sku === nv.sku);
      if (idx !== -1) {
        mergedVariants[idx].price = nv.price;
      } else {
        mergedVariants.push(nv);
      }
    });

    product.price_request = {
      price: dto.price,
      variants: mergedVariants,
      effective_date: effectiveDate,
      // sửa trạng thái thành draft thay vì pending để đúng với luồng nghiệp vụ
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
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product || !product.price_request)
      throw new NotFoundException('Không tìm thấy yêu cầu giá');

    if (product.price_request.status !== PriceRequestStatus.DRAFT) {
      throw new BadRequestException(
        'Chỉ có thể Submit các bản ghi ở trạng thái Draft',
      );
    }

    product.price_request.status = PriceRequestStatus.PENDING;
    await product.save();

    await this.auditLogsService.log({
      action: 'SUBMIT_PRICE_REQUEST',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: { message: 'Đẩy yêu cầu nháp lên chờ phê duyệt' },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã đẩy yêu cầu lên chờ phê duyệt' };
  }

  async approvePriceChange(
    id: string,
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
    if (!product || !product.price_request)
      throw new NotFoundException('Không có yêu cầu giá');

    if (product.price_request.status !== PriceRequestStatus.PENDING) {
      throw new BadRequestException(
        'Bản ghi này không ở trạng thái chờ duyệt (Pending)',
      );
    }

    if (isApproved) {
      product.price_request.status = PriceRequestStatus.APPROVED;
      product.price = product.price_request.price;
      product.currency = product.price_request.currency;
    } else {
      product.price_request.status = PriceRequestStatus.REJECTED;
      if (reason) product.price_request.reject_reason = reason;
    }

    product.price_request.approver_id = new Types.ObjectId(userId);

    await product.save();

    await this.auditLogsService.log({
      action: isApproved ? 'APPROVE_PRICE' : 'REJECT_PRICE',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: {
        result: product.price_request.status,
        old_price: product.price,
        new_price: product.price_request.price,
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
    productIds: string[],
    isApproved: boolean,
    reason: string,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    let successCount = 0;
    for (const id of productIds) {
      try {
        await this.approvePriceChange(
          id,
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
        console.error(`Bulk action failed for product ${id}:`, errorMessage);
      }
    }
    return {
      message: `Đã xử lý thành công ${successCount}/${productIds.length} bản ghi.`,
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

    const hasOrders = await this.orderModel.exists({
      'items.product_id': new Types.ObjectId(id),
    });

    if (hasOrders) {
      throw new BadRequestException(
        'Sản phẩm đã có phát sinh đơn hàng, không thể xóa. Vui lòng chuyển sang trạng thái Ngừng kinh doanh.',
      );
    }

    product.is_deleted = true;
    product.status = ProductStatus.DRAFT;
    await product.save();

    this.mediaService.bulkUpdateStatusByTarget(id, 'Hidden').catch((err) => {
      console.error('Lỗi tự động ẩn media khi soft delete:', err);
    });

    try {
      await this.algoliaService.removeProduct(id);
      console.log(`[Algolia] Đã gỡ sản phẩm ${id} do bị xóa.`);
    } catch (err) {
      console.error('Lỗi xóa Algolia khi Soft Delete:', err);
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

    return { message: 'Đã xóa vĩnh viễn sản phẩm và dữ liệu liên quan.' };
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
    const { categorySlug, sort, attributes } = dto;
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const category = await this.categoryModel
      .findOne({ slug: categorySlug })
      .lean();
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    const allCategories = await this.categoriesService.getAllChildCategories(
      category._id,
    );
    const categoryIds = [category._id, ...allCategories];

    const query: FilterQuery<ProductDocument> = {
      categories: { $in: categoryIds },
      status: ProductStatus.ACTIVE,
      is_deleted: false,
    };

    if (attributes) {
      const attributeFilters: FilterQuery<ProductDocument>[] = [];

      for (const [code, valuesStr] of Object.entries(attributes)) {
        if (!valuesStr) continue;

        const values = valuesStr
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v);

        if (values.length > 0) {
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

      if (attributeFilters.length > 0) {
        query.$and = attributeFilters;
      }
    }

    let sortOptions: { [key: string]: SortOrder } = {};
    switch (sort) {
      case SortOption.PRICE_ASC:
        sortOptions = { sale_price: 1, price: 1 };
        break;
      case SortOption.PRICE_DESC:
        sortOptions = { sale_price: -1, price: -1 };
        break;
      case SortOption.BEST_SELLER:
        sortOptions = { sold_count: -1 };
        break;
      default:
        sortOptions = { created_at: -1 };
    }

    const skip = (page - 1) * limit;

    const subCategories = await this.categoryModel
      .find({ parent_id: category._id })
      .select('name slug image')
      .lean();

    const [products, total] = await Promise.all([
      this.productModel
        .find(query)
        .select(
          'name slug price sale_price sale_start_date sale_end_date thumbnail rating_average review_count sold_count stock created_at',
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      this.productModel.countDocuments(query),
    ]);

    const breadcrumbs = await this.buildBreadcrumbs(category);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
        sub_categories: subCategories,
        category: {
          name: category.name,
          description: category.description,
          banner: category.image,
        },
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
}
