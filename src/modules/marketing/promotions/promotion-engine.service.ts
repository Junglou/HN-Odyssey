import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Combo, ComboType, ComboStatus } from './schemas/combo.schema';
import { CreateComboDto } from './dto/create-combo.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { ApplicableScope } from './schemas/flash-sale.schema';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';

export interface CartItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountedPrice?: number;
  appliedCombo?: string;
  [key: string]: any;
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
export class PromotionEngineService {
  constructor(
    @InjectModel(Combo.name) private comboModel: Model<Combo>,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel('Order') private orderModel: Model<Order>,
  ) {}

  async applyCombos(
    cartItems: CartItemInput[],
  ): Promise<{ items: CartItemInput[]; totalDiscount: number }> {
    const now = new Date();
    const activeCombos = await this.comboModel.find({
      status: ComboStatus.ACTIVE,
      start_date: { $lte: now },
      end_date: { $gte: now },
    });
    let totalDiscount = 0;
    const processedItems = JSON.parse(
      JSON.stringify(cartItems),
    ) as CartItemInput[];

    for (const combo of activeCombos) {
      if (
        combo.type === ComboType.BUY_X_GET_Y ||
        combo.type === ComboType.DIRECT_DISCOUNT
      ) {
        const comboScopeValues = combo.applicable_scope_values;
        const matchedItems = processedItems.filter((item) => {
          if (
            (combo.applicable_scope_type as unknown as ApplicableScope) ===
            ApplicableScope.PRODUCT
          ) {
            return comboScopeValues.includes(item.productId.toString());
          }
          return false;
        });

        const totalQty = matchedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        if (totalQty >= combo.min_quantity) {
          for (const item of matchedItems) {
            let discountAmount = 0;
            if (combo.is_percent) {
              discountAmount = Math.round(
                (item.unitPrice * combo.discount_value) / 100,
              );
            } else {
              discountAmount = combo.discount_value;
            }
            item.discountedPrice = item.unitPrice - discountAmount;
            item.appliedCombo = combo.name;
            totalDiscount += discountAmount * item.quantity;
          }
        }
      }
    }
    return { items: processedItems, totalDiscount };
  }

  async createCombo(dto: CreateComboDto, userId?: string) {
    if (new Date(dto.start_date) >= new Date(dto.end_date))
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
    const newCombo = new this.comboModel({
      ...dto,
      status: dto.status || ComboStatus.PENDING,
    });
    const savedCombo = await newCombo.save();

    await this.auditLogsService.log({
      action: 'CREATE_PROMOTION_COMBO',
      collection_name: 'combos',
      actor_id: userId,
      target_id: savedCombo._id.toString(),
      department: Department.MARKETING,
      detail: {
        name: dto.name,
        type: dto.type,
        discount_value: dto.discount_value,
      },
      is_success: true,
    });
    return savedCombo;
  }

  async findAllCombos() {
    return this.comboModel.find().sort({ createdAt: -1 });
  }

  async updateCombo(id: string, dto: Partial<CreateComboDto>) {
    const combo = await this.comboModel.findById(id);
    if (!combo) throw new BadRequestException('Không tìm thấy Combo/Discount');

    const isCoreFieldChanged =
      (dto.name !== undefined && dto.name !== combo.name) ||
      (dto.type !== undefined && dto.type !== combo.type) ||
      (dto.discount_value !== undefined &&
        Number(dto.discount_value) !== Number(combo.discount_value)) ||
      (dto.is_percent !== undefined && dto.is_percent !== combo.is_percent) ||
      (dto.min_quantity !== undefined &&
        Number(dto.min_quantity) !== Number(combo.min_quantity));

    const currentScopeCount = combo.applicable_scope_values?.length || 0;
    const newScopeCount = dto.applicable_scope_values
      ? dto.applicable_scope_values.length
      : currentScopeCount;
    const isTryingToClearScope =
      dto.applicable_scope_values && dto.applicable_scope_values.length === 0;
    const isScopeChanged =
      dto.applicable_scope_values &&
      JSON.stringify(dto.applicable_scope_values) !==
        JSON.stringify(combo.applicable_scope_values);

    // ĐÃ FIX: Thêm || isScopeChanged
    if (isCoreFieldChanged || isScopeChanged) {
      const targetStatus = dto.status || combo.status;

      if (
        targetStatus !== ComboStatus.INACTIVE &&
        targetStatus !== ComboStatus.DRAFT
      ) {
        throw new BadRequestException(
          'Vui lòng chuyển chương trình sang trạng thái Inactive (Deactive) hoặc Bản nháp (Draft) trước khi chỉnh sửa thông tin.',
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
            ? combo.applicable_scope_values
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

    Object.assign(combo, dto);
    return combo.save();
  }

  async deleteCombo(id: string) {
    const combo = await this.comboModel.findById(id);
    if (!combo)
      throw new BadRequestException('Không tìm thấy Combo/Discount để xóa');

    if (
      combo.status !== ComboStatus.INACTIVE &&
      combo.status !== ComboStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Vui lòng chuyển sang trạng thái Inactive (Deactive) trước khi xóa.',
      );
    }

    if (
      combo.applicable_scope_values &&
      combo.applicable_scope_values.length > 0
    ) {
      throw new BadRequestException(
        'Chương trình đang áp dụng cho sản phẩm. Vui lòng gỡ tất cả sản phẩm khỏi danh sách trước khi xóa.',
      );
    }

    await this.comboModel.findByIdAndDelete(id);
    return { message: 'Đã xóa thành công' };
  }

  async bulkUpdateStatus(
    ids: string[],
    action: 'ACTIVATE' | 'DEACTIVATE',
    userId?: string,
  ) {
    const combos = await this.comboModel.find({ _id: { $in: ids } });
    const now = new Date();

    for (const combo of combos) {
      if (combo.status === ComboStatus.EXPIRED) continue;
      if (action === 'ACTIVATE') {
        combo.status =
          now >= new Date(combo.start_date)
            ? ComboStatus.ACTIVE
            : ComboStatus.PENDING;
      } else {
        combo.status = ComboStatus.INACTIVE;
      }
      await combo.save();
    }

    if (userId) {
      await this.auditLogsService.log({
        action: 'BULK_UPDATE_COMBO_STATUS',
        collection_name: 'combos',
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
    const combos = await this.comboModel.find({ _id: { $in: ids } });
    const deletableIds: Types.ObjectId[] = [];

    for (const combo of combos) {
      if (
        combo.status !== ComboStatus.INACTIVE &&
        combo.status !== ComboStatus.DRAFT
      )
        continue;
      if (
        combo.applicable_scope_values &&
        combo.applicable_scope_values.length > 0
      )
        continue;

      deletableIds.push(combo._id);
    }

    // 1. NẾU KHÔNG CÓ CÁI NÀO ĐỦ ĐIỀU KIỆN XÓA -> Quăng lỗi 400 đỏ
    if (deletableIds.length === 0) {
      throw new BadRequestException(
        'Không thể xóa. Tất cả chương trình được chọn đều đang Active hoặc chưa gỡ sản phẩm.',
      );
    }

    // 2. TIẾN HÀNH XÓA CÁC MÃ HỢP LỆ
    await this.comboModel.deleteMany({ _id: { $in: deletableIds } });

    if (userId) {
      await this.auditLogsService.log({
        action: 'BULK_DELETE_COMBO',
        collection_name: 'combos',
        actor_id: userId,
        target_id: 'BULK_ACTION',
        department: Department.MARKETING,
        detail: { deleted_ids: deletableIds },
        is_success: true,
      });
    }

    // 3. NẾU XÓA ĐƯỢC MỘT PHẦN VÀ BỎ QUA MỘT PHẦN -> Trả về 200 OK kèm lời nhắc (Để FE hiện Toast Vàng)
    if (deletableIds.length < ids.length) {
      return {
        success: true,
        message:
          'Đã xóa. Tuy nhiên một số chương trình bị chặn xóa do đang Active hoặc chưa gỡ hết sản phẩm.',
      };
    }

    // NẾU XÓA SẠCH 100% -> Trả về 200 OK (FE hiện Toast Xanh)
    return { success: true, message: 'Đã xóa hàng loạt thành công!' };
  }
}
