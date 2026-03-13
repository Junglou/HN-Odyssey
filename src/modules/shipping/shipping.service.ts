import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  INNER_DISTRICTS,
  SHIPPING_FEES,
} from 'src/common/constants/shipping.constant';
import { CartItem, OrderItem } from 'src/common/interfaces/order.interface';
import { ShippingConfig } from './schemas/shipping-config.schema';
import {
  AdministrativeUnit,
  AdministrativeUnitDocument,
} from './schemas/administrative-unit.schema';

export interface IShippingConfig {
  default_provider: string;
  ghn_config?: { token: string; shop_id: number; is_active: boolean };
  ghtk_config?: { token: string; is_active: boolean };
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  constructor(
    @InjectModel(ShippingConfig.name)
    private readonly shippingConfigModel: Model<ShippingConfig>,
    @InjectModel(AdministrativeUnit.name)
    private unitModel: Model<AdministrativeUnitDocument>,
  ) {}

  async getDefaultConfig(): Promise<IShippingConfig | null> {
    return await this.shippingConfigModel
      .findOne({ code: 'DEFAULT_CONFIG' })
      .lean<IShippingConfig>() // Ép kiểu ngay tại đây để Mongoose trả về đúng Interface
      .exec();
  }

  // Nên thêm kiểu trả về cho hàm này luôn để các biến unitMapping bên kia không bị lỗi 'any'
  async getMappingCode(gsoCode: string): Promise<AdministrativeUnit | null> {
    return this.unitModel.findOne({ code: gsoCode }).lean().exec();
  }

  async calculateShippingFee(
    cityCode: string | undefined | null,
    districtCode: string | undefined | null,
    items: (CartItem | OrderItem)[],
    isInstant: boolean = false,
  ): Promise<number> {
    if (!cityCode || !districtCode) return 0;

    if (SHIPPING_FEES.UNSUPPORTED_PROVINCES.includes(cityCode)) {
      throw new BadRequestException(
        'Rất tiếc, H&N Odyssey chưa hỗ trợ giao hàng đến Tỉnh/Thành phố này.',
      );
    }

    // 1. Lấy Config từ DB (Ưu tiên config động)
    const config = await this.shippingConfigModel
      .findOne({ code: 'DEFAULT_CONFIG' })
      .lean();

    // 2. Định nghĩa Fallback & Merge Type an toàn
    const defaultFees = {
      inner_city: SHIPPING_FEES.INNER_CITY,
      outer_city: SHIPPING_FEES.OUTER_CITY,
      other_province: SHIPPING_FEES.OTHER_PROVINCE,
      instant_surcharge: SHIPPING_FEES.INSTANT_SURCHARGE,
      bulky_surcharge: SHIPPING_FEES.BULKY_SURCHARGE,
      max_weight_instant: SHIPPING_FEES.MAX_WEIGHT_INSTANT,
      max_weight_standard: SHIPPING_FEES.MAX_WEIGHT_STANDARD,
    };

    // Ép kiểu config.fees về dạng đầy đủ
    const fees = config?.fees
      ? { ...defaultFees, ...config.fees }
      : defaultFees;

    const innerDistrictsMap = config?.inner_districts || INNER_DISTRICTS;

    // 3. Tính trọng lượng tổng
    const totalWeight = items.reduce((w, i) => {
      const itemWithWeight = i as unknown as {
        weight?: number;
        product_name?: string;
      };
      const weightPerItem = itemWithWeight.weight || 0;

      if (weightPerItem <= 0) {
        this.logger.warn(
          `CẢNH BÁO: Sản phẩm [${itemWithWeight.product_name}] chưa nhập cân nặng. Đang dùng fallback 0.5kg.`,
        );
        return w + 0.5 * i.quantity;
      }

      return w + weightPerItem * i.quantity;
    }, 0);

    // Validate trọng lượng tối đa
    if (totalWeight > fees.max_weight_standard) {
      throw new BadRequestException(
        `Đơn hàng quá nặng (> ${fees.max_weight_standard}kg). Vui lòng liên hệ hotline.`,
      );
    }

    // 4. Logic Vùng miền
    let baseFee = fees.other_province;
    let isInnerCity = false;

    // Kiểm tra TP.HCM (79) hoặc Hà Nội (01)
    if (['79', '01'].includes(cityCode)) {
      const districtList =
        innerDistrictsMap[cityCode as keyof typeof innerDistrictsMap] || [];

      if (districtList.includes(districtCode)) {
        baseFee = fees.inner_city;
        isInnerCity = true;
      } else {
        baseFee = fees.outer_city;
      }
    }

    // 5. Logic Hỏa tốc
    if (isInstant) {
      if (!['79', '01'].includes(cityCode)) {
        throw new BadRequestException(
          'Hỏa tốc chỉ hỗ trợ tại TP.HCM và Hà Nội',
        );
      }
      if (!isInnerCity) {
        throw new BadRequestException('Khu vực này chưa hỗ trợ Giao Hỏa Tốc.');
      }
      if (totalWeight > fees.max_weight_instant) {
        throw new BadRequestException(
          `Giao Hỏa Tốc chỉ áp dụng dưới ${fees.max_weight_instant}kg.`,
        );
      }

      const vnTime = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const currentHour = new Date(vnTime).getHours();
      // Giờ hành chính: 8h - 16h
      if (currentHour < 8 || currentHour >= 16) {
        throw new BadRequestException('Hỏa tốc chỉ hoạt động 08:00 - 16:00.');
      }
    }

    // 6. Tổng phí
    let totalFee = baseFee;
    if (totalWeight > 30) totalFee += fees.bulky_surcharge; // Phụ phí cồng kềnh
    if (isInstant) totalFee += fees.instant_surcharge; // Phụ phí hỏa tốc

    return totalFee;
  }
}
