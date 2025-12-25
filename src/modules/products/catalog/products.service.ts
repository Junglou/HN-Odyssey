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

// import { OrdersService } from '../../sales/orders/orders.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
    private readonly tagsService: TagsService,
    // [TODO] Inject OrdersService sau khi hoàn thành Module Sales
    // @Inject(forwardRef(() => OrdersService)) private ordersService: OrdersService,
  ) {}

  // HELPER METHODS

  private createSlug(name: string): string {
    return defaultSlugify(name, { lower: true, strict: true, locale: 'vi' });
  }

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
        `Mã SKU '${sku}' đã tồn tại (Sản phẩm hoặc Biến thể)`,
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
      ]), // Cho phép ảnh, tiêu đề
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
    ip: string,
    userAgent: string,
  ) {
    // 1. Kiểm tra trùng SKU của sản phẩm cha
    await this.checkSkuExists(createProductDto.sku);

    const variants = createProductDto.variants || [];

    // VALIDATION BIẾN THỂ (AC1 & AC2)
    if (variants.length > 0) {
      // 2.1. Kiểm tra trùng SKU trong chính danh sách gửi lên (Internal Duplicates)
      const variantSkus = variants.map((v) => v.sku);
      if (new Set(variantSkus).size !== variantSkus.length) {
        throw new BadRequestException(
          'Danh sách biến thể có chứa SKU trùng nhau',
        );
      }

      // 2.2. Lấy cấu trúc thuộc tính của biến thể đầu tiên làm chuẩn
      const firstVariantAttrs = variants[0].attributes;

      // RULE 1: Giới hạn tối đa 3 nhóm thuộc tính
      if (firstVariantAttrs.length > 3) {
        throw new BadRequestException(
          'Hệ thống chỉ hỗ trợ tối đa 3 nhóm thuộc tính phân loại (Ví dụ: Màu, Size, Chất liệu)',
        );
      }

      // Tạo chuỗi key chuẩn để so sánh (Ví dụ: "Màu,Size")
      const standardKeys = firstVariantAttrs
        .map((a) => a.k)
        .sort()
        .join(',');

      for (const variant of variants) {
        // 2.3. Kiểm tra trùng SKU với Database
        await this.checkSkuExists(variant.sku);

        // RULE 2: Đảm bảo cấu trúc đồng nhất
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

    // 3. Tự động tạo Slug & Kiểm tra trùng
    const slug =
      createProductDto.slug || this.createSlug(createProductDto.name);
    const slugExists = await this.productModel.exists({ slug });
    if (slugExists) throw new ConflictException('Đường dẫn (Slug) đã tồn tại');

    // 4. Tính toán Specs
    const specs = this.calculateSpecs(variants);

    // 5. Khởi tạo Model
    const newProduct = new this.productModel({
      ...createProductDto,
      categories: createProductDto.category_ids.map(
        (id) => new Types.ObjectId(id),
      ),
      slug,
      status: ProductStatus.DRAFT, // Mặc định là Nháp
      has_variants: variants.length > 0,
      specs,
      created_by: userId,
    });

    if (createProductDto.description) {
      createProductDto.description = this.sanitizeContent(
        createProductDto.description,
      ); // Lọc mã độc trước khi lưu
    }

    // 6. Lưu vào DB
    await newProduct.save();

    // 7. Ghi Audit Log (Updated theo Interface DTO)
    await this.auditLogsService.log({
      action: 'CREATE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: newProduct._id,
      detail: {
        sku: newProduct.sku,
        name: newProduct.name,
        has_variants: newProduct.has_variants,
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

    const filter: any = {};

    // 2. Lọc theo Status
    if (status) filter.status = status;

    // 3. Xử lý Category ID an toàn (Tránh crash nếu id sai format)
    if (category_id) {
      if (Types.ObjectId.isValid(category_id)) {
        filter.categories = new Types.ObjectId(category_id as string);
      } else {
        filter.categories = new Types.ObjectId();
      }
    }

    // 4. Tìm kiếm Full-text (Yêu cầu DB đã đánh index text cho trường name/description)
    if (keyword && keyword.trim() !== '') {
      filter.$text = { $search: keyword.trim() };
    }

    // 5. Xử lý Sort
    let sortOption: any = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };

    // Select fields để tối ưu performance (bỏ bớt các trường nặng như description chi tiết nếu không cần)
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
        .lean(), // .lean() giúp query nhanh hơn do trả về plain object
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
      .findById(id)
      .populate('categories', 'name slug')
      .lean();
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug, status: ProductStatus.ACTIVE })
      .populate('categories', 'name slug')
      .lean();

    if (!product) {
      throw new NotFoundException(
        'Sản phẩm không tìm thấy hoặc chưa được mở bán',
      );
    }
    return product;
  }

  //UPDATE THÔNG TIN
  async update(
    id: string,
    updateDto: UpdateProductDto,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // Check trùng SKU nếu có thay đổi
    if (updateDto.sku && updateDto.sku !== product.sku) {
      await this.checkSkuExists(updateDto.sku, id);
    }

    // Check trùng Tên sản phẩm
    if (updateDto.name && updateDto.name !== product.name) {
      const nameExists = await this.productModel.exists({
        name: updateDto.name,
        _id: { $ne: id },
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

    // Check trùng Slug
    if (updateDto.slug && updateDto.slug !== product.slug) {
      const exists = await this.productModel.exists({
        slug: updateDto.slug,
        _id: { $ne: id },
      });
      if (exists) throw new ConflictException('Slug đã trùng');
    }

    if (updateDto.description) {
      updateDto.description = this.sanitizeContent(updateDto.description); // Lọc mã độc trước khi lưu
    }

    Object.assign(product, updateDto);
    await product.save();

    // Log Update Info
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

  //UPDATE TRẠNG THÁI
  async updateStatus(
    id: string,
    statusDto: UpdateProductStatusDto,
    userId: string,
    userRoles: Role[],
    ip: string,
    userAgent: string,
  ) {
    const { status } = statusDto;
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    const oldStatus = product.status;

    // [AC2] KIỂM TRA QUYỀN
    const isAdmin =
      userRoles.includes(Role.MANAGER) || userRoles.includes(Role.SUPER_ADMIN);

    // Nếu không phải Admin mà đòi Active -> Chặn
    if (!isAdmin && status === ProductStatus.ACTIVE) {
      throw new BadRequestException(
        'Bạn không có quyền kích hoạt bán. Vui lòng chọn trạng thái "Chờ duyệt" để Quản lý kiểm tra.',
      );
    }

    // [AC7] KIỂM TRA DỮ LIỆU
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

    // Log Status Change
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

  //REQUEST PRICE
  async requestPriceUpdate(
    id: string,
    dto: UpdateProductPriceDto,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    // Removed debug log for cleaner code
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    //Xử lý inputSalePrice để tránh lỗi undefined
    const inputSalePrice = dto.sale_price ?? 0;

    // [AC3] Validation: Giá KM phải nhỏ hơn Giá bán (Sản phẩm cha)
    if (inputSalePrice > 0 && inputSalePrice >= dto.price) {
      throw new BadRequestException(
        'Giá khuyến mãi phải nhỏ hơn giá niêm yết (Sản phẩm chính)',
      );
    }

    //Định nghĩa kiểu mảng rõ ràng
    const pendingVariants: PendingVariantPrice[] = [];

    // [AC3 & AC6] Validation cho các biến thể
    if (dto.variants && dto.variants.length > 0) {
      // Kiểm tra xem sản phẩm có biến thể thật không
      if (!product.has_variants) {
        throw new BadRequestException(
          'Sản phẩm này không có biến thể để sửa giá',
        );
      }

      for (const vDto of dto.variants) {
        // Check xem SKU có tồn tại trong sản phẩm này không
        const existVariant = product.variants.find((v) => v.sku === vDto.sku);
        if (!existVariant) {
          throw new BadRequestException(
            `SKU biến thể '${vDto.sku}' không tồn tại trong sản phẩm này`,
          );
        }

        // Check logic giá
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

    // [AC4] Cấu hình thời gian
    const startDate = dto.sale_start_date
      ? new Date(dto.sale_start_date)
      : undefined;
    const endDate = dto.sale_end_date ? new Date(dto.sale_end_date) : undefined;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException(
        'Ngày kết thúc khuyến mãi phải sau ngày bắt đầu',
      );
    }

    // [AC1] Lưu vào trạng thái chờ duyệt (Pending)
    product.pending_price_change = {
      price: dto.price,
      sale_price: inputSalePrice,
      sale_start_date: startDate,
      sale_end_date: endDate,
      variants: pendingVariants,
      requester_id: userId,
      requested_at: new Date(),
    };

    await product.save();

    // [AC8] Log lịch sử
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

  //APPROVE PRICE
  async approvePriceChange(
    id: string,
    isApproved: boolean,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('SP không tồn tại');
    if (!product.pending_price_change) {
      throw new BadRequestException(
        'Không có yêu cầu thay đổi giá nào đang chờ',
      );
    }

    const pending = product.pending_price_change;

    if (isApproved) {
      // 1. Áp dụng giá cho Sản phẩm cha
      product.price = pending.price;
      product.sale_price = pending.sale_price;

      //Cast sang 'any' hoặc 'Date' để tránh lỗi gán undefined vào field Date
      product.sale_start_date = pending.sale_start_date as any;
      product.sale_end_date = pending.sale_end_date as any;

      // 2. Áp dụng giá cho Biến thể (AC6)
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

    // Xóa trạng thái pending sau khi xử lý
    product.pending_price_change = null;
    await product.save();

    // [AC8] Log chi tiết: Ai duyệt, Thời gian nào
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

  //DELETE
  async remove(id: string, userId: string, ip: string, userAgent: string) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // [TODO: PENDING US.76 AC1] KIỂM TRA RÀNG BUỘC ĐƠN HÀNG
    // Hiện tại chưa có module Order nên tạm thời bỏ qua bước này.

    // [AC6] Xóa tất cả ảnh và video liên quan trong ổ cứng
    if (product.images && product.images.length > 0) {
      product.images.forEach((img) => this.deletePhysicalFile(img));
    }
    if (product.thumbnail) this.deletePhysicalFile(product.thumbnail);
    if (product.video) this.deletePhysicalFile(product.video);

    // Xóa ảnh của biến thể
    if (product.variants) {
      product.variants.forEach((v) => {
        if (v.image) this.deletePhysicalFile(v.image);
      });
    }

    // Xóa DB
    const snapshot = { sku: product.sku, name: product.name };
    await this.productModel.findByIdAndDelete(id);

    // Log (Updated theo DTO)
    await this.auditLogsService.log({
      action: 'DELETE_PRODUCT',
      collection_name: 'products',
      actor_id: userId,
      target_id: id,
      detail: {
        deleted_product: snapshot,
        reason: 'Hard delete requested by Admin',
      },
      ip: ip,
      user_agent: userAgent,
    });
    return { message: 'Đã xóa sản phẩm và toàn bộ dữ liệu file liên quan' };
  }

  // [AC6] API hỗ trợ xóa lẻ file (Optional - Nếu Frontend gọi xóa từng ảnh)
  async removeMediaFile(filePath: string) {
    this.deletePhysicalFile(filePath);
    return { message: 'Đã xóa file vật lý' };
  }

  async updateTags(
    id: string,
    tags: string[],
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');

    // [AC3] Ràng buộc: Chỉ được chọn từ danh sách Tag đã tồn tại
    const isValid = await this.tagsService.validateTagsExist(tags);
    if (!isValid) {
      throw new BadRequestException(
        'Phát hiện thẻ không hợp lệ (không tồn tại trong hệ thống). Vui lòng kiểm tra lại.',
      );
    }

    const oldTags = product.tags;
    product.tags = tags; // Ghi đè danh sách mới (Xử lý cả gán và gỡ)
    await product.save();

    // [AC8] Ghi Log
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

  // [AC6] GẮN THẺ HÀNG LOẠT (BULK TAGGING)
  // [FIX] Thêm ip và userAgent vào tham số để log chính xác hơn
  async bulkAddTags(
    productIds: string[],
    tagsToAdd: string[],
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    // 1. Validate tags
    const isValid = await this.tagsService.validateTagsExist(tagsToAdd);
    if (!isValid) throw new BadRequestException('Thẻ không tồn tại.');

    // 2. Update hàng loạt (Dùng $addToSet để tránh trùng thẻ cũ)
    const result = await this.productModel.updateMany(
      { _id: { $in: productIds } },
      { $addToSet: { tags: { $each: tagsToAdd } } },
    );

    // [AC8] Ghi log tổng (Updated theo DTO)
    // Lưu ý: target_id null là hợp lệ vì tác động nhiều object, chi tiết xem trong detail
    await this.auditLogsService.log({
      action: 'BULK_TAGGING',
      collection_name: 'products',
      actor_id: userId,
      target_id: null,
      detail: {
        products_affected: result.modifiedCount,
        tags_added: tagsToAdd,
        target_ids: productIds, // Lưu danh sách ID bị ảnh hưởng để truy vết
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
      // Chuyển đường dẫn tương đối (/uploads/...) thành tuyệt đối
      // Giả sử thư mục gốc project là nơi chạy lệnh start
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
