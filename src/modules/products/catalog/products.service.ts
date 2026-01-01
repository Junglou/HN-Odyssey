import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
  ProductAttributeParams,
  PendingVariantPrice,
} from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import {
  UpdateProductDto,
  UpdateProductPriceDto,
  UpdateProductStatusDto,
} from './dto/update-product.dto';
import defaultSlugify from 'slugify';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AuditLogsService } from '../../system/audit-logs/audit-logs.service';
import * as fs from 'fs';
import * as path from 'path';
import { TagsService } from '../tags/tags.service';
import { Role } from 'src/common/enums/role.enum';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
    private readonly tagsService: TagsService,
  ) {}

  // HELPER METHODS

  private createSlug(name: string): string {
    return defaultSlugify(name, { lower: true, strict: true, locale: 'vi' });
  }

  //Check SKU toàn hệ thống (kể cả active hay deleted) để đảm bảo an toàn tuyệt đối
  // Nếu đã Soft Delete và đổi tên SKU rồi thì check này vẫn pass.
  private async checkSkuExists(sku: string, excludeId?: string): Promise<void> {
    const query: any = {
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

  private calculateSpecs(variants: any[]): ProductAttributeParams[] {
    if (!variants || variants.length === 0) return [];

    const map = new Map<string, Set<string>>();

    variants.forEach((variant) => {
      if (variant.attributes) {
        variant.attributes.forEach((attr) => {
          if (!map.has(attr.k)) {
            map.set(attr.k, new Set());
          }
          const valuesSet = map.get(attr.k);
          if (valuesSet) {
            valuesSet.add(attr.v);
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

  // MAIN FEATURES

  async create(
    createProductDto: CreateProductDto,
    userId: string,
    userRoles: Role[],
    ip: string,
    userAgent: string,
  ) {
    // 1. Kiểm tra trùng SKU (Product level)
    await this.checkSkuExists(createProductDto.sku);

    const variants = createProductDto.variants || [];

    //Phân quyền nhập liệu:
    // Nếu là STAFF (và không phải Manager/Admin) -> Bắt buộc Giá = 0 (Chờ duyệt giá sau)
    const isStaff =
      userRoles.includes(Role.STAFF) &&
      !userRoles.includes(Role.MANAGER) &&
      !userRoles.includes(Role.SUPER_ADMIN);

    if (isStaff) {
      // Ép giá sản phẩm cha về 0
      createProductDto.price = 0;
      createProductDto.sale_price = 0;

      // Ép giá toàn bộ biến thể về 0
      if (variants.length > 0) {
        variants.forEach((v) => {
          v.price = 0;
          v.sale_price = 0;
        });
      }
    }

    // 2. VALIDATION BIẾN THỂ (Nếu có)
    if (variants.length > 0) {
      // Check trùng SKU trong nội bộ danh sách biến thể
      const variantSkus = variants.map((v) => v.sku);
      if (new Set(variantSkus).size !== variantSkus.length) {
        throw new BadRequestException(
          'Danh sách biến thể có chứa SKU trùng nhau',
        );
      }

      // Check giới hạn số lượng thuộc tính (Max 3: VD Màu, Size, Chất liệu)
      const firstVariantAttrs = variants[0].attributes;
      if (firstVariantAttrs.length > 3) {
        throw new BadRequestException(
          'Hệ thống chỉ hỗ trợ tối đa 3 nhóm thuộc tính phân loại',
        );
      }

      // Check tính nhất quán của thuộc tính (Các biến thể phải có cùng keys)
      const standardKeys = firstVariantAttrs
        .map((a) => a.k)
        .sort()
        .join(',');

      for (const variant of variants) {
        // Check trùng SKU biến thể với DB
        await this.checkSkuExists(variant.sku);

        const currentKeys = variant.attributes
          .map((a) => a.k)
          .sort()
          .join(',');

        if (currentKeys !== standardKeys) {
          throw new BadRequestException(
            `Lỗi cấu trúc biến thể (SKU: ${variant.sku}): Các biến thể phải có cùng nhóm thuộc tính.`,
          );
        }
      }
    }

    // 3. Tạo Slug & Sanitize HTML
    const slug =
      createProductDto.slug || this.createSlug(createProductDto.name);
    const slugExists = await this.productModel.exists({ slug });
    if (slugExists) throw new ConflictException('Đường dẫn (Slug) đã tồn tại');

    const specs = this.calculateSpecs(variants);

    let cleanDescription = createProductDto.description;
    if (cleanDescription) {
      cleanDescription = this.sanitizeContent(cleanDescription);
    }

    // 4. Khởi tạo Model
    const newProduct = new this.productModel({
      ...createProductDto,
      categories: createProductDto.category_ids.map(
        (id) => new Types.ObjectId(id),
      ),
      slug,
      status: ProductStatus.DRAFT, // Mặc định tạo mới là DRAFT
      has_variants: variants.length > 0,
      specs,
      created_by: new Types.ObjectId(userId),
      is_deleted: false,
      description: cleanDescription,
      price: createProductDto.price,
      sale_price: createProductDto.sale_price,
      variants: variants,
    });

    await newProduct.save();

    // 5. Ghi Audit Log
    await this.auditLogsService.log({
      action: 'CREATE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: newProduct._id,
      detail: {
        sku: newProduct.sku,
        name: newProduct.name,
        is_staff_created: isStaff,
        initial_price: newProduct.price,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return newProduct;
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { keyword, category_id, status, sort = 'newest' } = query;

    const filter: any = {
      is_deleted: false,
    };

    if (status) filter.status = status;

    if (category_id) {
      if (Types.ObjectId.isValid(category_id)) {
        filter.categories = new Types.ObjectId(category_id as string);
      } else {
        filter.categories = new Types.ObjectId();
      }
    }

    if (keyword && keyword.trim() !== '') {
      filter.$text = { $search: keyword.trim() };
    }

    let sortOption: any = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };

    const selectFields =
      'name sku price sale_price thumbnail slug categories status stock rating_average created_at';

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

  async findPendingPriceRequests(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Chỉ tìm sản phẩm chưa xóa
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
    // 1. Lấy thông tin sản phẩm gốc để biết Category của nó
    const product = await this.productModel
      .findById(id)
      .select('categories price');
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // 2. Tìm các sản phẩm khác có cùng ít nhất 1 category
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

    // Nếu không tìm thấy (ví dụ danh mục chỉ có 1 sp), có thể fallback lấy sản phẩm mới nhất
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

  async findBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug, status: ProductStatus.ACTIVE, is_deleted: false })
      .populate('categories', 'name slug')
      .lean();

    if (!product) {
      throw new NotFoundException(
        'Sản phẩm không tìm thấy hoặc chưa được mở bán',
      );
    }
    return product;
  }

  // UPDATE THÔNG TIN
  async update(
    id: string,
    updateDto: UpdateProductDto,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // Check trùng SKU
    if (updateDto.sku && updateDto.sku !== product.sku) {
      await this.checkSkuExists(updateDto.sku, id);
    }

    // Check trùng Tên
    if (updateDto.name && updateDto.name !== product.name) {
      const nameExists = await this.productModel.exists({
        name: updateDto.name,
        _id: { $ne: id },
        is_deleted: false,
      });
      if (nameExists) throw new ConflictException('Tên sản phẩm đã tồn tại');
    }

    if (updateDto.variants) {
      product.has_variants = updateDto.variants.length > 0;
      product.specs = this.calculateSpecs(updateDto.variants);
    }

    if (updateDto.category_ids) {
      if (updateDto.category_ids.length === 0)
        throw new BadRequestException('Cần ít nhất 1 danh mục');
      product.categories = updateDto.category_ids.map(
        (id) => new Types.ObjectId(id),
      ) as any;
      delete updateDto.category_ids;
    }

    if (updateDto.slug && updateDto.slug !== product.slug) {
      const exists = await this.productModel.exists({
        slug: updateDto.slug,
        _id: { $ne: id },
      });
      if (exists) throw new ConflictException('Slug đã trùng');
    }

    if (updateDto.description) {
      updateDto.description = this.sanitizeContent(updateDto.description);
    }

    Object.assign(product, updateDto);
    await product.save();

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_INFO',
      collection_name: 'products',
      actor_id: userId,
      target_id: product._id,
      detail: { changes: updateDto },
      ip: ip,
      user_agent: userAgent,
    });
    return product;
  }

  // UPDATE TRẠNG THÁI
  async updateStatus(
    id: string,
    statusDto: UpdateProductStatusDto,
    userId: string,
    userRoles: Role[],
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

    const isAdmin =
      userRoles.includes(Role.MANAGER) || userRoles.includes(Role.SUPER_ADMIN);

    if (!isAdmin && status === ProductStatus.ACTIVE) {
      throw new BadRequestException(
        'Bạn không có quyền kích hoạt bán. Vui lòng chọn trạng thái "Chờ duyệt" để Quản lý kiểm tra.',
      );
    }

    if (status === ProductStatus.ACTIVE) {
      if (
        product.price <= 0 &&
        (!product.variants || product.variants.length === 0)
      ) {
        throw new BadRequestException('Sản phẩm phải có giá bán > 0');
      }
      if (product.has_variants) {
        const validVariant = product.variants.some(
          (v) => v.active && v.price > 0,
        );
        if (!validVariant)
          throw new BadRequestException('Cần ít nhất 1 biến thể có giá bán');
      }
      if (
        !product.thumbnail &&
        (!product.images || product.images.length === 0)
      ) {
        throw new BadRequestException('Sản phẩm phải có hình ảnh');
      }
    }

    product.status = status;
    await product.save();

    await this.auditLogsService.log({
      action: 'UPDATE_PRODUCT_STATUS',
      collection_name: 'products',
      actor_id: userId,
      target_id: product._id,
      detail: { old_status: oldStatus, new_status: status },
      ip: ip,
      user_agent: userAgent,
    });

    return product;
  }

  // REQUEST PRICE
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

    const inputSalePrice = dto.sale_price ?? 0;
    if (inputSalePrice > 0 && inputSalePrice >= dto.price) {
      throw new BadRequestException(
        'Giá khuyến mãi phải nhỏ hơn giá niêm yết (Sản phẩm chính)',
      );
    }

    const pendingVariants: PendingVariantPrice[] = [];
    if (dto.variants && dto.variants.length > 0) {
      if (!product.has_variants) {
        throw new BadRequestException(
          'Sản phẩm này không có biến thể để sửa giá',
        );
      }

      for (const vDto of dto.variants) {
        const existVariant = product.variants.find((v) => v.sku === vDto.sku);
        if (!existVariant) {
          throw new BadRequestException(
            `SKU biến thể '${vDto.sku}' không tồn tại trong sản phẩm này`,
          );
        }

        const variantSalePrice = vDto.sale_price ?? 0;
        if (variantSalePrice > 0 && variantSalePrice >= vDto.price) {
          throw new BadRequestException(
            `Biến thể ${vDto.sku}: Giá khuyến mãi phải nhỏ hơn giá niêm yết`,
          );
        }

        pendingVariants.push({
          sku: vDto.sku,
          price: vDto.price,
          sale_price: variantSalePrice,
        });
      }
    }

    const startDate = dto.sale_start_date
      ? new Date(dto.sale_start_date)
      : undefined;
    const endDate = dto.sale_end_date ? new Date(dto.sale_end_date) : undefined;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException(
        'Ngày kết thúc khuyến mãi phải sau ngày bắt đầu',
      );
    }

    product.pending_price_change = {
      price: dto.price,
      sale_price: inputSalePrice,
      sale_start_date: startDate,
      sale_end_date: endDate,
      variants: pendingVariants,
      requester_id: new Types.ObjectId(userId),
      requested_at: new Date(),
    };

    await product.save();

    await this.auditLogsService.log({
      action: 'REQUEST_PRICE_UPDATE',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      detail: {
        message: 'Gửi yêu cầu đổi giá',
        new_price: dto.price,
        variants_count: pendingVariants.length,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return {
      message: 'Đã gửi yêu cầu phê duyệt giá thành công',
      product_id: id,
    };
  }

  // APPROVE PRICE
  async approvePriceChange(
    id: string,
    isApproved: boolean,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('SP không tồn tại');
    if (!product.pending_price_change) {
      throw new BadRequestException(
        'Không có yêu cầu thay đổi giá nào đang chờ',
      );
    }

    const pending = product.pending_price_change;

    if (isApproved) {
      product.price = pending.price;
      product.sale_price = pending.sale_price;
      product.sale_start_date = pending.sale_start_date as any;
      product.sale_end_date = pending.sale_end_date as any;

      if (pending.variants && pending.variants.length > 0) {
        pending.variants.forEach((pV) => {
          const variantIndex = product.variants.findIndex(
            (v) => v.sku === pV.sku,
          );
          if (variantIndex !== -1) {
            product.variants[variantIndex].price = pV.price;
            product.variants[variantIndex].sale_price = pV.sale_price;
          }
        });
      }
    }

    product.pending_price_change = null;
    await product.save();

    await this.auditLogsService.log({
      action: isApproved ? 'APPROVE_PRICE' : 'REJECT_PRICE',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      detail: {
        result: isApproved ? 'APPROVED' : 'REJECTED',
        requester_id: pending.requester_id,
        applied_price: isApproved ? pending.price : 'N/A',
      },
      ip: ip,
      user_agent: userAgent,
    });

    return {
      message: isApproved
        ? 'Đã phê duyệt và áp dụng giá mới'
        : 'Đã từ chối yêu cầu đổi giá',
    };
  }

  //SOFT DELETE
  async remove(id: string, userId: string, ip: string, userAgent: string) {
    const product = await this.productModel.findOne({
      _id: id,
      is_deleted: false,
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // [Soft Delete]
    product.is_deleted = true;
    product.deleted_at = new Date();
    product.status = ProductStatus.INACTIVE;

    //Đổi SKU và Slug để giải phóng mã cho sản phẩm mới
    // Nếu không đổi, khi tạo sản phẩm mới cùng SKU sẽ bị báo lỗi Conflict
    const timestamp = Date.now();
    product.sku = `${product.sku}_DEL_${timestamp}`;
    product.slug = `${product.slug}-deleted-${timestamp}`;

    //KHÔNG XÓA FILE VẬT LÝ và KHÔNG XÓA CỨNG DB
    // Để đảm bảo lịch sử đơn hàng vẫn xem được ảnh sản phẩm (nếu cần)
    // và admin có thể khôi phục lại dữ liệu nếu xóa nhầm.

    await product.save();

    // Log
    await this.auditLogsService.log({
      action: 'DELETE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      detail: {
        reason: 'Soft delete requested by Admin',
        new_sku: product.sku,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return { message: 'Đã chuyển sản phẩm vào thùng rác (Soft Delete)' };
  }

  // API hỗ trợ xóa lẻ file
  async removeMediaFile(filePath: string) {
    this.deletePhysicalFile(filePath);
    return { message: 'Đã xóa file vật lý' };
  }

  // Các hàm Tags giữ nguyên
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

  private deletePhysicalFile(relativePath: string) {
    if (!relativePath) return;
    try {
      const absolutePath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`[FILE] Deleted: ${absolutePath}`);
      }
    } catch (error) {
      console.error(`[FILE] Error deleting file: ${relativePath}`, error);
    }
  }
}
