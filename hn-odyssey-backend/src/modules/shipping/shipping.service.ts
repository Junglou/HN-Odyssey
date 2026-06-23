import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model } from 'mongoose';
import {
  INNER_DISTRICTS,
  SHIPPING_FEES,
} from 'src/common/constants/shipping.constant';
import { CartItem, OrderItem } from 'src/common/interfaces/order.interface';
import { ShippingConfig } from './schemas/shipping-config.schema';
import {
  AdministrativeUnit,
  AdministrativeUnitDocument,
  UnitType,
} from './schemas/administrative-unit.schema';

export interface IShippingConfig {
  default_provider: string;
  ghn_config?: { token: string; shop_id: number; is_active: boolean };
  ghtk_config?: { token: string; is_active: boolean };
}

// BƯỚC 1: ĐỊNH NGHĨA INTERFACE CHO DỮ LIỆU GHN ĐỂ XÓA LỖI ANY VÀ ESLINT
interface GhnProvince {
  ProvinceID: number;
  ProvinceName: string;
}

interface GhnDistrict {
  DistrictID: number;
  DistrictName: string;
}

interface GhnWard {
  WardCode: string;
  WardName: string;
}

// BỔ SUNG KHUÔN (GENERIC INTERFACE) CHO RESPONSE CỦA FETCH ĐỂ FIX LỖI 2552
interface GhnResponse<T> {
  code: number;
  message: string;
  data: T;
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
      .lean<IShippingConfig>()
      .exec();
  }

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

    const config = await this.shippingConfigModel
      .findOne({ code: 'DEFAULT_CONFIG' })
      .lean();

    const defaultFees = {
      inner_city: SHIPPING_FEES.INNER_CITY,
      outer_city: SHIPPING_FEES.OUTER_CITY,
      other_province: SHIPPING_FEES.OTHER_PROVINCE,
      instant_surcharge: SHIPPING_FEES.INSTANT_SURCHARGE,
      bulky_surcharge: SHIPPING_FEES.BULKY_SURCHARGE,
      max_weight_instant: SHIPPING_FEES.MAX_WEIGHT_INSTANT,
      max_weight_standard: SHIPPING_FEES.MAX_WEIGHT_STANDARD,
    };

    const fees = config?.fees
      ? { ...defaultFees, ...config.fees }
      : defaultFees;

    const innerDistrictsMap = config?.inner_districts || INNER_DISTRICTS;

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

    if (totalWeight > fees.max_weight_standard) {
      throw new BadRequestException(
        `Đơn hàng quá nặng (> ${fees.max_weight_standard}kg). Vui lòng liên hệ hotline.`,
      );
    }

    let baseFee = fees.other_province;
    let isInnerCity = false;

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
      if (currentHour < 8 || currentHour >= 16) {
        throw new BadRequestException('Hỏa tốc chỉ hoạt động 08:00 - 16:00.');
      }
    }

    let totalFee = baseFee;
    if (totalWeight > 30) totalFee += fees.bulky_surcharge;
    if (isInstant) totalFee += fees.instant_surcharge;

    return totalFee;
  }

  async getProvinces(): Promise<AdministrativeUnit[]> {
    return this.unitModel
      .find({ type: UnitType.PROVINCE, is_active: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async getDistricts(provinceCode: string): Promise<AdministrativeUnit[]> {
    return this.unitModel
      .find({
        type: UnitType.DISTRICT,
        parent_code: provinceCode,
        is_active: true,
      })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async getWards(districtCode: string): Promise<AdministrativeUnit[]> {
    return this.unitModel
      .find({ type: UnitType.WARD, parent_code: districtCode, is_active: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async seedGhnLocations() {
    this.logger.log('Bắt đầu đồng bộ dữ liệu địa giới từ hệ thống GHN...');

    const config = await this.shippingConfigModel
      .findOne({ code: 'DEFAULT_CONFIG' })
      .lean<IShippingConfig>()
      .exec();

    // 1. Đã sửa lại đúng tên biến GHN_TOKEN theo file .env của bạn
    const token = config?.ghn_config?.token || process.env.GHN_TOKEN;

    if (!token) {
      this.logger.error('Thiếu cấu hình Token GHN.');
      throw new Error('Chưa cấu hình GHN_TOKEN trong hệ thống.');
    }

    // 2. CẤU HÌNH MÔI TRƯỜNG GHN (QUAN TRỌNG)
    // Nếu token của bạn lấy từ khachhang.dev.ghn.vn -> Mở comment dòng DEV, đóng dòng PROD
    const GHN_BASE_URL =
      'https://dev-online-gateway.ghn.vn/shiip/public-api/master-data';

    // Nếu token của bạn lấy từ khachhang.ghn.vn (Làm thật) -> Mở comment dòng PROD, đóng dòng DEV
    // const GHN_BASE_URL = 'https://online-gateway.ghn.vn/shiip/public-api/master-data';

    const headers = {
      Token: token,
      'Content-Type': 'application/json',
    };

    try {
      // 1. Lấy danh sách Tỉnh/Thành
      const provRes = await fetch(`${GHN_BASE_URL}/province`, { headers });
      const provJson = (await provRes.json()) as GhnResponse<GhnProvince[]>;

      if (provJson.code !== 200) {
        throw new Error(
          provJson.message || 'Lấy danh sách Tỉnh thất bại từ GHN',
        );
      }

      const provinces = provJson.data || [];

      for (const prov of provinces) {
        const provCode = String(prov.ProvinceID);

        await this.unitModel.findOneAndUpdate(
          { code: provCode },
          {
            code: provCode,
            name: prov.ProvinceName,
            name_with_type: prov.ProvinceName,
            type: UnitType.PROVINCE,
            parent_code: '',
            mapping: { ghn_id: prov.ProvinceID, ghtk_name: prov.ProvinceName },
            is_active: true,
          },
          { upsert: true, new: true },
        );
        this.logger.log(`[GHN Sync] Đã lưu Tỉnh/Thành: ${prov.ProvinceName}`);

        // 2. Lấy danh sách Quận/Huyện của Tỉnh này
        const distRes = await fetch(
          `${GHN_BASE_URL}/district?province_id=${prov.ProvinceID}`,
          { headers },
        );
        const distJson = (await distRes.json()) as GhnResponse<GhnDistrict[]>;
        const districts = distJson.data || [];

        for (const dist of districts) {
          const distCode = String(dist.DistrictID);

          await this.unitModel.findOneAndUpdate(
            { code: distCode },
            {
              code: distCode,
              name: dist.DistrictName,
              name_with_type: dist.DistrictName,
              type: UnitType.DISTRICT,
              parent_code: provCode,
              mapping: {
                ghn_id: dist.DistrictID,
                ghtk_name: dist.DistrictName,
              },
              is_active: true,
            },
            { upsert: true, new: true },
          );

          // 3. Lấy danh sách Phường/Xã của Quận/Huyện này
          const wardRes = await fetch(
            `${GHN_BASE_URL}/ward?district_id=${dist.DistrictID}`,
            { headers },
          );
          const wardJson = (await wardRes.json()) as GhnResponse<GhnWard[]>;
          const wards = wardJson.data || [];

          if (wards.length > 0) {
            const wardOps: AnyBulkWriteOperation<AdministrativeUnitDocument>[] =
              wards.map((ward) => ({
                updateOne: {
                  filter: { code: String(ward.WardCode) },
                  update: {
                    $set: {
                      code: String(ward.WardCode),
                      name: ward.WardName,
                      name_with_type: ward.WardName,
                      type: UnitType.WARD,
                      parent_code: distCode,
                      mapping: {
                        ghn_ward_code: String(ward.WardCode),
                        ghtk_name: ward.WardName,
                      },
                      is_active: true,
                    },
                  },
                  upsert: true,
                },
              }));
            await this.unitModel.bulkWrite(wardOps);
          }
        }
      }

      this.logger.log('Hoàn tất 100% đồng bộ dữ liệu địa giới từ GHN!');
      return { success: true, message: 'Đồng bộ dữ liệu thành công' };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Lỗi khi đồng bộ dữ liệu từ GHN:', err.message);
      throw new Error(
        'Đồng bộ thất bại, kiểm tra lại cấu hình mạng hoặc Token.',
      );
    }
  }
}
