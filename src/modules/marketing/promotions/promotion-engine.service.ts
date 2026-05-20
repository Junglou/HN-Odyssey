import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Combo, ComboType, ComboStatus } from './schemas/combo.schema';
import { CreateComboDto } from './dto/create-combo.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { ApplicableScope } from './schemas/flash-sale.schema';

// 1. Định nghĩa Interface cho Item trong giỏ hàng (Để tránh dùng any)
export interface CartItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountedPrice?: number;
  appliedCombo?: string;
  [key: string]: any; // Cho phép các trường khác nếu có
}

@Injectable()
export class PromotionEngineService {
  constructor(
    @InjectModel(Combo.name) private comboModel: Model<Combo>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // 2. Cập nhật kiểu CartItemInput[] và xử lý logic Scope an toàn
  async applyCombos(
    cartItems: CartItemInput[],
  ): Promise<{ items: CartItemInput[]; totalDiscount: number }> {
    // Lấy tất cả Combo/Discount đang có trạng thái ACTIVE
    const now = new Date();
    const activeCombos = await this.comboModel.find({
      status: ComboStatus.ACTIVE,
      start_date: { $lte: now },
      end_date: { $gte: now },
    });

    let totalDiscount = 0;

    // 3. Clone items an toàn và ép kiểu rõ ràng
    const processedItems = JSON.parse(
      JSON.stringify(cartItems),
    ) as CartItemInput[];

    // Logic tìm Combo
    for (const combo of activeCombos) {
      if (
        combo.type === ComboType.BUY_X_GET_Y ||
        combo.type === ComboType.DIRECT_DISCOUNT
      ) {
        // 4. Lấy danh sách giá trị áp dụng
        const comboScopeValues = combo.applicable_scope_values;

        // Tìm các item trong giỏ khớp với sản phẩm trong Combo
        const matchedItems = processedItems.filter((item) => {
          // [ĐÃ FIX LỖI 1]: Ép kiểu an toàn sang enum trước khi so sánh
          if (
            (combo.applicable_scope_type as unknown as ApplicableScope) ===
            ApplicableScope.PRODUCT
          ) {
            return comboScopeValues.includes(item.productId.toString());
          }
          // Nếu sau này có logic so sánh Category/Tag thì thêm vào đây
          return false;
        });

        // Tính tổng số lượng các món khớp
        const totalQty = matchedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        // Nếu đủ điều kiện số lượng tối thiểu
        if (totalQty >= combo.min_quantity) {
          // Tính tiền giảm
          for (const item of matchedItems) {
            let discountAmount = 0;
            if (combo.is_percent) {
              discountAmount = Math.round(
                (item.unitPrice * combo.discount_value) / 100,
              );
            } else {
              discountAmount = combo.discount_value;
            }

            // Cập nhật lại giá của item để hiển thị
            item.discountedPrice = item.unitPrice - discountAmount;
            item.appliedCombo = combo.name;

            // Cộng tổng tiền giảm cho cả giỏ
            totalDiscount += discountAmount * item.quantity;
          }
        }
      }
    }

    return { items: processedItems, totalDiscount };
  }

  async createCombo(dto: CreateComboDto, userId?: string) {
    if (new Date(dto.start_date) >= new Date(dto.end_date)) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
    }

    const newCombo = new this.comboModel({
      ...dto,
      status: dto.status || ComboStatus.PENDING,
    });

    const savedCombo = await newCombo.save();

    await this.auditLogsService.log({
      action: 'CREATE_PROMOTION_COMBO',
      collection_name: 'combos',
      actor_id: userId,
      // [ĐÃ FIX LỖI 2]: Dùng phương thức .toString() của Mongoose ObjectID thay vì ép kiểu as string
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
    Object.assign(combo, dto);
    return combo.save();
  }

  async deleteCombo(id: string) {
    const combo = await this.comboModel.findByIdAndDelete(id);
    if (!combo)
      throw new BadRequestException('Không tìm thấy Combo/Discount để xóa');
    return { message: 'Đã xóa thành công' };
  }

  // THÊM MỚI 2 HÀM BULK Ở CUỐI CLASS PromotionEngineService
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

    // SỬ DỤNG userId ĐỂ GHI AUDIT LOG
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
    const deletableIds = combos
      .filter((c) => c.status !== ComboStatus.ACTIVE)
      .map((c) => c._id);

    if (deletableIds.length > 0) {
      await this.comboModel.deleteMany({ _id: { $in: deletableIds } });

      // SỬ DỤNG userId ĐỂ GHI AUDIT LOG
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
    }

    if (deletableIds.length < ids.length) {
      throw new BadRequestException(
        'Đã xóa, nhưng một số chương trình đang diễn ra bị bỏ qua do hệ thống cấm xóa.',
      );
    }
    return { success: true };
  }
}
