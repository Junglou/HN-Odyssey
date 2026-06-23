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
import { Order } from 'src/modules/sales/orders/schemas/order.schema';

export interface QueryFlashSaleDto {
  page?: number | string;
  limit?: number | string;
  status?: FlashSaleStatus;
}

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

const ONGOING_ORDER_STATUSES = [
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

@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);

  constructor(
    @InjectModel(FlashSale.name) private flashSaleModel: Model<FlashSale>,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel('Order') private orderModel: Model<Order>,
  ) {}

  async createFlashSale(dto: CreateFlashSaleDto, userId?: string) {
    const start = new Date(dto.start_time);
    const end = new Date(dto.end_time);
    if (end <= start)
      throw new BadRequestException(
        'Thời gian kết thúc phải lớn hơn thời gian bắt đầu',
      );
    const uniqueScopeValues = dto.applicable_scope_values
      ? [
          ...new Set(
            dto.applicable_scope_values.map((id: string) => id.toString()),
          ),
        ]
      : [];
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
      if (validProducts.length !== uniqueScopeValues.length)
        throw new BadRequestException(
          'Một hoặc nhiều sản phẩm trong danh sách không tồn tại, đang bị ẩn hoặc đã bị xóa.',
        );
    }
    if (uniqueScopeValues.length > 0) {
      const conflictingSales = await this.flashSaleModel.find({
        status: { $in: [FlashSaleStatus.PENDING, FlashSaleStatus.ACTIVE] },
        applicable_scope_type: dto.applicable_scope_type,
        applicable_scope_values: { $in: uniqueScopeValues },
        $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
      });
      if (conflictingSales.length > 0)
        throw new BadRequestException(
          `Một hoặc nhiều ${dto.applicable_scope_type} đã tồn tại trong Flash Sale khác trùng thời gian.`,
        );
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

  async updateFlashSale(
    id: string,
    dto: Partial<CreateFlashSaleDto>,
    userId?: string,
  ) {
    const flashSale = await this.flashSaleModel.findById(id);
    if (!flashSale)
      throw new NotFoundException('Không tìm thấy chương trình Flash Sale');

    const isCoreFieldChanged =
      (dto.name !== undefined && dto.name !== flashSale.name) ||
      (dto.discount_type !== undefined &&
        dto.discount_type !== flashSale.discount_type) ||
      (dto.discount_value !== undefined &&
        Number(dto.discount_value) !== Number(flashSale.discount_value));

    const currentScopeCount = flashSale.applicable_scope_values?.length || 0;
    const newScopeCount = dto.applicable_scope_values
      ? dto.applicable_scope_values.length
      : currentScopeCount;
    const isTryingToClearScope =
      dto.applicable_scope_values && dto.applicable_scope_values.length === 0;
    const isScopeChanged =
      dto.applicable_scope_values &&
      JSON.stringify(dto.applicable_scope_values) !==
        JSON.stringify(flashSale.applicable_scope_values);

    // ĐÃ FIX: Thêm || isScopeChanged
    if (isCoreFieldChanged || isScopeChanged) {
      const targetStatus = dto.status || flashSale.status;

      if (
        targetStatus !== FlashSaleStatus.INACTIVE &&
        targetStatus !== FlashSaleStatus.DRAFT &&
        targetStatus !== FlashSaleStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Vui lòng chuyển chương trình sang trạng thái Inactive (Deactive) hoặc Bản nháp (Draft) trước khi chỉnh sửa.',
        );
      }

      if (
        currentScopeCount > 0 &&
        isCoreFieldChanged &&
        !isTryingToClearScope
      ) {
        throw new BadRequestException(
          'Chương trình đang áp dụng cho sản phẩm. Vui lòng gỡ tất cả sản phẩm khỏi danh sách trước khi sửa thông tin khác.',
        );
      }

      if (currentScopeCount > 0 || newScopeCount > 0) {
        const checkValues =
          (currentScopeCount > 0
            ? flashSale.applicable_scope_values
            : dto.applicable_scope_values) || [];

        const objectIds = checkValues
          .map((val) => {
            try {
              return new Types.ObjectId(val.toString());
            } catch {
              return null;
            }
          })
          .filter((val) => val !== null);

        const hasOngoingOrder = await this.orderModel.exists({
          'items.product_id': { $in: objectIds },
          status: { $in: ONGOING_ORDER_STATUSES },
        });

        if (hasOngoingOrder) {
          throw new BadRequestException(
            'Có đơn hàng đang mua sản phẩm thuộc chương trình này chưa hoàn tất. Vui lòng chờ hoàn thành đơn.',
          );
        }
      }
    }

    // Các phần xử lý mảng Scope và Lưu lại phía sau giữ nguyên...
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
        if (validProducts.length !== uniqueScopeValues.length)
          throw new BadRequestException(
            'Một hoặc nhiều sản phẩm không tồn tại hoặc bị ẩn.',
          );
      }

      const start = dto.start_time
        ? new Date(dto.start_time)
        : flashSale.start_time;
      const end = dto.end_time ? new Date(dto.end_time) : flashSale.end_time;
      if (end <= start)
        throw new BadRequestException(
          'Thời gian kết thúc phải lớn hơn thời gian bắt đầu',
        );

      const conflictingSales = await this.flashSaleModel.find({
        _id: { $ne: id },
        status: { $in: [FlashSaleStatus.PENDING, FlashSaleStatus.ACTIVE] },
        applicable_scope_type: checkScopeType,
        applicable_scope_values: { $in: uniqueScopeValues },
        $or: [{ start_time: { $lt: end }, end_time: { $gt: start } }],
      });

      if (conflictingSales.length > 0)
        throw new BadRequestException(
          `Danh sách áp dụng bị trùng lặp với Flash Sale khác trong cùng khung giờ.`,
        );
    } else if (
      dto.applicable_scope_values &&
      dto.applicable_scope_values.length === 0
    ) {
      uniqueScopeValues = [];
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

  async getActiveFlashSales() {
    const activeSale = await this.flashSaleModel
      .findOne({ status: FlashSaleStatus.ACTIVE })
      .lean();
    if (!activeSale) return null;
    let processedProducts: ProcessedProduct[] = [];
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

  async hardDeleteFlashSale(id: string, userId?: string) {
    const flashSale = await this.flashSaleModel.findById(id);
    if (!flashSale)
      throw new NotFoundException('Không tìm thấy chương trình Flash Sale');

    if (
      flashSale.status !== FlashSaleStatus.INACTIVE &&
      flashSale.status !== FlashSaleStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Vui lòng chuyển sang trạng thái Inactive (Deactive) trước khi xóa.',
      );
    }

    if (
      flashSale.applicable_scope_values &&
      flashSale.applicable_scope_values.length > 0
    ) {
      throw new BadRequestException(
        'Chương trình đang áp dụng cho sản phẩm. Vui lòng gỡ tất cả sản phẩm khỏi danh sách trước khi xóa.',
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
    const deletableIds: Types.ObjectId[] = [];

    for (const sale of sales) {
      if (
        sale.status !== FlashSaleStatus.INACTIVE &&
        sale.status !== FlashSaleStatus.DRAFT
      )
        continue;
      if (
        sale.applicable_scope_values &&
        sale.applicable_scope_values.length > 0
      )
        continue;

      deletableIds.push(sale._id);
    }

    if (deletableIds.length === 0) {
      throw new BadRequestException(
        'Không thể xóa. Tất cả chương trình được chọn đều đang Active hoặc chưa gỡ sản phẩm.',
      );
    }

    await this.flashSaleModel.deleteMany({ _id: { $in: deletableIds } });

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

    // Trả về 200 để Frontend hiện Toast màu Vàng
    if (deletableIds.length < ids.length) {
      return {
        success: true,
        message:
          'Đã xóa. Tuy nhiên một số chương trình bị chặn xóa do đang Active hoặc chưa gỡ hết sản phẩm.',
      };
    }

    return { success: true, message: 'Đã xóa hàng loạt thành công!' };
  }
}
