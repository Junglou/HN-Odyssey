import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  FlashSale,
  FlashSaleStatus,
  FlashSaleDiscountType,
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

// 2. Interface định nghĩa kiểu khi populate mảng product_ids để tránh lỗi 'any'
export interface PopulatedProduct {
  _id: string;
  name: string;
  price: number;
  thumbnail: string;
  slug: string;
  badges: any[];
}

@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);

  constructor(
    @InjectModel(FlashSale.name) private flashSaleModel: Model<FlashSale>,
    @InjectModel('Product') private productModel: Model<any>,
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

    if (dto.product_ids && dto.product_ids.length > 0) {
      // 1. Loại bỏ các ID trùng lặp do người dùng gửi lên
      const uniqueProductIds = [
        ...new Set(dto.product_ids.map((id) => id.toString())),
      ];

      const validProducts = await this.productModel
        .find({
          _id: { $in: uniqueProductIds },
          status: 'ACTIVE',
          is_deleted: false,
        })
        .select('_id')
        .lean();

      // 2. So sánh với mảng đã lọc trùng lặp
      if (validProducts.length !== uniqueProductIds.length) {
        throw new BadRequestException(
          'Một hoặc nhiều sản phẩm trong danh sách không tồn tại, đang bị ẩn hoặc đã bị xóa.',
        );
      }
    }

    const conflictingSales = await this.flashSaleModel.find({
      status: { $in: [FlashSaleStatus.PENDING, FlashSaleStatus.ACTIVE] },
      product_ids: { $in: dto.product_ids },
      $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
    });

    if (conflictingSales.length > 0) {
      throw new BadRequestException(
        'Một hoặc nhiều sản phẩm đã tồn tại trong Flash Sale khác trùng thời gian.',
      );
    }

    const newFlashSale = new this.flashSaleModel({
      ...dto,
      status:
        start <= new Date() ? FlashSaleStatus.ACTIVE : FlashSaleStatus.PENDING,
    });

    const savedSale = await newFlashSale.save();

    await this.auditLogsService.log({
      action: 'CREATE_FLASH_SALE',
      collection_name: 'flash_sales',
      actor_id: userId,
      target_id: savedSale._id,
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

    // 4. Khai báo kiểu FilterQuery chuẩn của Mongoose
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
    dto: Partial<CreateFlashSaleDto>, // 5. Ép kiểu DTO
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

    if (dto.product_ids && dto.product_ids.length > 0) {
      // 1. Loại bỏ các ID trùng lặp do người dùng gửi lên
      const uniqueProductIds = [
        ...new Set(dto.product_ids.map((id) => id.toString())),
      ];

      const validProducts = await this.productModel
        .find({
          _id: { $in: uniqueProductIds },
          status: 'PUBLISHED',
          is_deleted: false,
        })
        .select('_id')
        .lean();

      // 2. So sánh với mảng đã lọc trùng lặp
      if (validProducts.length !== uniqueProductIds.length) {
        throw new BadRequestException(
          'Một hoặc nhiều sản phẩm trong danh sách không tồn tại, đang bị ẩn hoặc đã bị xóa.',
        );
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
        product_ids: { $in: dto.product_ids },
        $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
      });

      if (conflictingSales.length > 0) {
        throw new BadRequestException(
          'Sản phẩm trùng lặp với Flash Sale khác trong cùng khung giờ.',
        );
      }
    }

    Object.assign(flashSale, dto);
    const updated = await flashSale.save();

    await this.auditLogsService.log({
      action: 'UPDATE_FLASH_SALE',
      collection_name: 'flash_sales',
      actor_id: userId,
      target_id: updated._id,
      department: Department.MARKETING,
      is_success: true,
    });

    return updated;
  }

  // (AC7): API Trả về cho Frontend xem Flash Sale đang diễn ra kèm thời gian đếm ngược
  async getActiveFlashSales() {
    // 6. Cấu trúc lại kiểu trả về để .lean() không xuất ra kiểu 'any'
    type ActiveSalePopulated = Omit<FlashSale, 'product_ids'> & {
      product_ids: PopulatedProduct[];
    };

    const activeSale = await this.flashSaleModel
      .findOne({ status: FlashSaleStatus.ACTIVE })
      .populate('product_ids', 'name price thumbnail slug badges')
      .lean<ActiveSalePopulated>();

    if (!activeSale) return null;

    const processedProducts = activeSale.product_ids.map(
      (prod: PopulatedProduct) => {
        let flashPrice = prod.price;
        if (activeSale.discount_type === FlashSaleDiscountType.PERCENTAGE) {
          flashPrice =
            prod.price - (prod.price * activeSale.discount_value) / 100;
        } else {
          flashPrice = activeSale.discount_value;
        }
        return {
          ...prod,
          flash_sale_price: flashPrice > 0 ? flashPrice : 0,
        };
      },
    );

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
      target_id: flashSale._id,
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
}
