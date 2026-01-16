import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Combo, ComboType } from './schemas/combo.schema';
import { CreateComboDto } from './dto/create-combo.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';

@Injectable()
export class PromotionEngineService {
  constructor(
    @InjectModel(Combo.name) private comboModel: Model<Combo>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async applyCombos(
    cartItems: any[],
  ): Promise<{ items: any[]; totalDiscount: number }> {
    // 1. Lấy tất cả Combo đang chạy
    const now = new Date();
    const activeCombos = await this.comboModel.find({
      active: true,
      start_date: { $lte: now },
      end_date: { $gte: now },
    });

    let totalDiscount = 0;
    // Clone items để không ảnh hưởng dữ liệu gốc
    const processedItems = JSON.parse(JSON.stringify(cartItems));

    // 2. Logic tìm Combo (Đơn giản hóa cho trường hợp Mua 2 giảm 10%)
    for (const combo of activeCombos) {
      if (combo.type === ComboType.BUY_X_GET_Y) {
        // Tìm các item trong giỏ khớp với sản phẩm trong Combo
        const matchedItems = processedItems.filter((item) =>
          combo.product_ids
            .map((id) => id.toString())
            .includes(item.productId.toString()),
        );

        // Tính tổng số lượng các món khớp
        const totalQty = matchedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        // Nếu đủ điều kiện (AC10: Mua 2 giảm 10%)
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
      active: true,
    });

    const savedCombo = await newCombo.save();

    await this.auditLogsService.log({
      action: 'CREATE_PROMOTION_COMBO',
      collection_name: 'combos',
      actor_id: userId,
      target_id: savedCombo._id,
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
}
