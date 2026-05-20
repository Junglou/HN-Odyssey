import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types, Document } from 'mongoose';
import {
  FlashSale,
  FlashSaleStatus,
  FlashSaleDiscountType,
  ApplicableScope,
} from './schemas/flash-sale.schema';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Cron, CronExpression } from '@nestjs/schedule';

// 1. Interface định nghĩa kiểu cho Query truyền vào hàm findAll
export interface QueryFlashSaleDto {
  page?: number | string;
  limit?: number | string;
  status?: FlashSaleStatus;
}

// 2. Định nghĩa Interface Product chuẩn để xóa bỏ hoàn toàn Model<any>
export interface ProductDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  price: number;
  thumbnail: string;
  slug: string;
  badges: string[];
  status: string;
  is_deleted: boolean;
}

export interface ProcessedProduct {
  _id: string;
  name: string;
  price: number;
  thumbnail: string;
  slug: string;
  badges: string[];
  flash_sale_price: number;
}

@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);

  constructor(
    @InjectModel(FlashSale.name) private flashSaleModel: Model<FlashSale>,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // AC1, AC2, AC3, AC4, AC5
  async createFlashSale(dto: CreateFlashSaleDto, userId?: string) {
    const start = new Date(dto.start_time);
    const end = new Date(dto.end_time);

    if (end <= start) {
      throw new BadRequestException(
        'Thời gian kết thúc phải lớn hơn thời gian bắt đầu',
      );
    }

    // Xử lý loại bỏ trùng lặp ID an toàn với Type String
    const uniqueScopeValues = dto.applicable_scope_values
      ? [
          ...new Set(
            dto.applicable_scope_values.map((id: string) => id.toString()),
          ),
        ]
      : [];

    // Chỉ validate tồn tại trong DB nếu Scope là PRODUCT
    if (
      dto.applicable_scope_type === (ApplicableScope.PRODUCT as string) &&
      uniqueScopeValues.length > 0
    ) {
      const validProducts = await this.productModel
        .find({
          _id: { $in: uniqueScopeValues },
          status: 'ACTIVE',
          is_deleted: false,
        })
        .select('_id')
        .lean();

      if (validProducts.length !== uniqueScopeValues.length) {
        throw new BadRequestException(
          'Một hoặc nhiều sản phẩm trong danh sách không tồn tại, đang bị ẩn hoặc đã bị xóa.',
        );
      }
    }

    // Kiểm tra trùng lặp thời gian cho Scope
    if (uniqueScopeValues.length > 0) {
      const conflictingSales = await this.flashSaleModel.find({
        status: { $in: [FlashSaleStatus.PENDING, FlashSaleStatus.ACTIVE] },
        applicable_scope_type: dto.applicable_scope_type,
        applicable_scope_values: { $in: uniqueScopeValues },
        $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
      });

      if (conflictingSales.length > 0) {
        throw new BadRequestException(
          `Một hoặc nhiều ${dto.applicable_scope_type} đã tồn tại trong Flash Sale khác trùng thời gian.`,
        );
      }
    }

    const newFlashSale = new this.flashSaleModel({
      ...dto,
      applicable_scope_values: uniqueScopeValues,
      status:
        start <= new Date() ? FlashSaleStatus.ACTIVE : FlashSaleStatus.PENDING,
    });

    const savedSale = await newFlashSale.save();

    await this.auditLogsService.log({
      action: 'CREATE_FLASH_SALE',
      collection_name: 'flash_sales',
      actor_id: userId,
      target_id: savedSale._id as unknown as string,
      department: Department.MARKETING,
      detail: {
        name: savedSale.name,
        discount_value: savedSale.discount_value,
      },
      is_success: true,
    });

    return savedSale;
  }

  // Lấy danh sách (Admin)
  async findAll(query: QueryFlashSaleDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<FlashSale> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.flashSaleModel
        .find(filter)
        .sort({ start_time: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.flashSaleModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  // Cập nhật Flash Sale
  async updateFlashSale(
    id: string,
    dto: Partial<CreateFlashSaleDto>,
    userId?: string,
  ) {
    const flashSale = await this.flashSaleModel.findById(id);
    if (!flashSale)
      throw new NotFoundException('Không tìm thấy chương trình Flash Sale');

    if (
      flashSale.status === FlashSaleStatus.ACTIVE ||
      flashSale.status === FlashSaleStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Không thể chỉnh sửa chương trình đang diễn ra hoặc đã kết thúc.',
      );
    }

    let uniqueScopeValues = flashSale.applicable_scope_values;

    if (dto.applicable_scope_values && dto.applicable_scope_values.length > 0) {
      uniqueScopeValues = [
        ...new Set(
          dto.applicable_scope_values.map((val: string) => val.toString()),
        ),
      ];
      const checkScopeType =
        dto.applicable_scope_type || flashSale.applicable_scope_type;

      if (checkScopeType === (ApplicableScope.PRODUCT as string)) {
        const validProducts = await this.productModel
          .find({
            _id: { $in: uniqueScopeValues },
            status: 'ACTIVE',
            is_deleted: false,
          })
          .select('_id')
          .lean();

        if (validProducts.length !== uniqueScopeValues.length) {
          throw new BadRequestException(
            'Một hoặc nhiều sản phẩm trong danh sách không tồn tại, đang bị ẩn hoặc đã bị xóa.',
          );
        }
      }

      const start = dto.start_time
        ? new Date(dto.start_time)
        : flashSale.start_time;
      const end = dto.end_time ? new Date(dto.end_time) : flashSale.end_time;

      if (end <= start) {
        throw new BadRequestException(
          'Thời gian kết thúc phải lớn hơn thời gian bắt đầu',
        );
      }

      const conflictingSales = await this.flashSaleModel.find({
        _id: { $ne: id },
        status: { $in: [FlashSaleStatus.PENDING, FlashSaleStatus.ACTIVE] },
        applicable_scope_type: checkScopeType,
        applicable_scope_values: { $in: uniqueScopeValues },
        $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
      });

      if (conflictingSales.length > 0) {
        throw new BadRequestException(
          `Danh sách áp dụng bị trùng lặp với Flash Sale khác trong cùng khung giờ.`,
        );
      }
    }

    Object.assign(flashSale, {
      ...dto,
      applicable_scope_values: uniqueScopeValues,
    });
    const updated = await flashSale.save();

    await this.auditLogsService.log({
      action: 'UPDATE_FLASH_SALE',
      collection_name: 'flash_sales',
      actor_id: userId,
      target_id: updated._id as unknown as string,
      department: Department.MARKETING,
      is_success: true,
    });

    return updated;
  }

  // (AC7): API Trả về cho Frontend xem Flash Sale đang diễn ra kèm thời gian đếm ngược
  async getActiveFlashSales() {
    const activeSale = await this.flashSaleModel
      .findOne({ status: FlashSaleStatus.ACTIVE })
      .lean();

    if (!activeSale) return null;

    let processedProducts: ProcessedProduct[] = [];

    // Nếu Scope là Product, tìm và map data Product trực tiếp trả về cho Client
    if (
      activeSale.applicable_scope_type ===
        (ApplicableScope.PRODUCT as string) &&
      activeSale.applicable_scope_values.length > 0
    ) {
      const products = await this.productModel
        .find({ _id: { $in: activeSale.applicable_scope_values } })
        .select('name price thumbnail slug badges')
        .lean<ProductDocument[]>();

      processedProducts = products.map((prod) => {
        let flashPrice = prod.price;
        if (activeSale.discount_type === FlashSaleDiscountType.PERCENTAGE) {
          flashPrice =
            prod.price - (prod.price * activeSale.discount_value) / 100;
        } else {
          flashPrice = activeSale.discount_value;
        }
        return {
          _id: prod._id.toString(),
          name: prod.name,
          price: prod.price,
          thumbnail: prod.thumbnail,
          slug: prod.slug,
          badges: prod.badges || [],
          flash_sale_price: flashPrice > 0 ? flashPrice : 0,
        };
      });
    }

    return {
      name: activeSale.name,
      end_time: activeSale.end_time,
      countdown_ms:
        new Date(activeSale.end_time).getTime() - new Date().getTime(),
      products: processedProducts,
    };
  }

  // AC8: Quy định Xóa vĩnh viễn (Hard Delete)
  async hardDeleteFlashSale(id: string, userId?: string) {
    const flashSale = await this.flashSaleModel.findById(id);
    if (!flashSale) {
      throw new NotFoundException('Không tìm thấy chương trình Flash Sale');
    }

    if (
      flashSale.status === FlashSaleStatus.ACTIVE ||
      flashSale.status === FlashSaleStatus.PENDING
    ) {
      throw new BadRequestException(
        'Không thể xóa chương trình đang hoặc sắp diễn ra.',
      );
    }

    await this.flashSaleModel.findByIdAndDelete(id);

    await this.auditLogsService.log({
      action: 'HARD_DELETE_FLASH_SALE',
      collection_name: 'flash_sales',
      actor_id: userId,
      target_id: flashSale._id as unknown as string,
      department: Department.MARKETING,
      detail: { name: flashSale.name },
      is_success: true,
    });

    return { message: 'Đã xóa vĩnh viễn chương trình Flash Sale' };
  }

  // AC6: Tự động kích hoạt hiển thị theo giờ (Chạy mỗi phút bằng CRON Job)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronStatusUpdate() {
    const now = new Date();

    await this.flashSaleModel.updateMany(
      { status: FlashSaleStatus.PENDING, start_time: { $lte: now } },
      { $set: { status: FlashSaleStatus.ACTIVE } },
    );

    await this.flashSaleModel.updateMany(
      { status: FlashSaleStatus.ACTIVE, end_time: { $lte: now } },
      { $set: { status: FlashSaleStatus.EXPIRED } },
    );
  }

  // THÊM MỚI 2 HÀM BULK Ở CUỐI CLASS FlashSalesService
  async bulkUpdateStatus(
    ids: string[],
    action: 'ACTIVATE' | 'DEACTIVATE',
    userId?: string,
  ) {
    const sales = await this.flashSaleModel.find({ _id: { $in: ids } });
    const now = new Date();
    for (const sale of sales) {
      if (sale.status === FlashSaleStatus.EXPIRED) continue;
      if (action === 'ACTIVATE') {
        sale.status =
          now >= sale.start_time
            ? FlashSaleStatus.ACTIVE
            : FlashSaleStatus.PENDING;
      } else {
        sale.status = FlashSaleStatus.INACTIVE;
      }
      await sale.save();
    }

    // SỬ DỤNG userId ĐỂ GHI AUDIT LOG
    if (userId) {
      await this.auditLogsService.log({
        action: 'BULK_UPDATE_FLASH_SALE_STATUS',
        collection_name: 'flash_sales',
        actor_id: userId,
        target_id: 'BULK_ACTION',
        department: Department.MARKETING,
        detail: { updated_ids: ids, action },
        is_success: true,
      });
    }

    return { success: true };
  }

  async bulkDelete(ids: string[], userId?: string) {
    const sales = await this.flashSaleModel.find({ _id: { $in: ids } });
    const deletableIds = sales
      .filter((s) => s.status !== FlashSaleStatus.ACTIVE)
      .map((s) => s._id);

    if (deletableIds.length > 0) {
      await this.flashSaleModel.deleteMany({ _id: { $in: deletableIds } });

      // SỬ DỤNG userId ĐỂ GHI AUDIT LOG
      if (userId) {
        await this.auditLogsService.log({
          action: 'BULK_DELETE_FLASH_SALE',
          collection_name: 'flash_sales',
          actor_id: userId,
          target_id: 'BULK_ACTION',
          department: Department.MARKETING,
          detail: { deleted_ids: deletableIds },
          is_success: true,
        });
      }
    }

    if (deletableIds.length < ids.length) {
      throw new BadRequestException(
        'Đã xóa, nhưng một số chương trình đang diễn ra bị bỏ qua do hệ thống cấm xóa.',
      );
    }
    return { success: true };
  }
}
