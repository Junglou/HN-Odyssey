import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface IShippingItem {
  name: string;
  code: string;
  quantity: number;
  price: number;
  weight: number;
}

interface IShippingOrderData {
  note?: string;
  customerName: string;
  phone: string;
  address: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  codAmount: number;
  wardCode: string;
  districtId: number;
  items: IShippingItem[];
  isReverse?: boolean; // Cờ nhận diện đơn Trade-in (RMA)
}

interface IGhnResponse<T> {
  data: T;
  code: number;
  message: string;
}

interface GhnCreateOrderResponse {
  order_code: string;
  total_fee: number;
  expected_delivery_time: string;
}

interface GhnErrorResponse {
  code: number;
  message: string;
  data: any;
}

@Injectable()
export class GhnService {
  private readonly logger = new Logger(GhnService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly shopId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2';
    this.apiToken = this.configService.get<string>('GHN_TOKEN') ?? '';
    this.shopId = this.configService.get<string>('GHN_SHOP_ID') ?? '';
  }

  // AC1: Đẩy đơn sang GHN
  async createShippingOrder(orderData: IShippingOrderData) {
    console.log('=== CHECK TOKEN GHN ===', this.apiToken);
    console.log('=== CHECK SHOP ID ===', this.shopId);

    // XỬ LÝ ĐẢO CHIỀU ĐIỂM A VÀ ĐIỂM B
    let senderReceiverPayload = {};

    if (orderData.isReverse) {
      // LUỒNG TRADE-IN: Khách hàng là người GỬI, Shop là người NHẬN
      senderReceiverPayload = {
        from_name: orderData.customerName,
        from_phone: orderData.phone,
        from_address: orderData.address,
        from_ward_code: String(orderData.wardCode),
        from_district_id: Number(orderData.districtId),

        to_name: 'Kho H&N Odyssey (Trade-in)',
        to_phone: this.configService.get<string>('SHOP_PHONE') || '0986023330',
        to_address:
          this.configService.get<string>('SHOP_ADDRESS') ||
          '217 Đ. Đặng Thuỳ Trâm, Phường 13, Bình Thạnh, Thành phố Hồ Chí Minh',

        // Bắt buộc cấu hình 2 biến này trong file .env để GHN nhận diện chính xác kho nhận hàng
        to_ward_code:
          this.configService.get<string>('GHN_SHOP_WARD_CODE') || '20211',
        to_district_id:
          Number(this.configService.get<string>('GHN_SHOP_DISTRICT_ID')) ||
          1444,
      };
    } else {
      // LUỒNG BÁN HÀNG BÌNH THƯỜNG: Shop là người GỬI (GHN tự nhận diện qua ShopId), Khách là người NHẬN
      senderReceiverPayload = {
        to_name: orderData.customerName,
        to_phone: orderData.phone,
        to_address: orderData.address,
        to_ward_code: String(orderData.wardCode),
        to_district_id: Number(orderData.districtId),
      };
    }

    try {
      const response = await axios.post<IGhnResponse<GhnCreateOrderResponse>>(
        `${this.apiUrl}/shipping-order/create`,
        {
          payment_type_id: 2, // 2: Người gửi / Người tạo đơn trả phí
          service_type_id: 2, // 2: Chuyển phát chuẩn
          note: orderData.note || 'Hàng dễ vỡ',
          required_note: 'CHOXEMHANGKHONGTHU',

          ...senderReceiverPayload, // Gắn object đã xử lý địa chỉ vào payload

          weight: Math.ceil(orderData.weight),
          length: orderData.length || 15,
          width: orderData.width || 15,
          height: orderData.height || 15,
          cod_amount: Math.round(orderData.codAmount),

          items: orderData.items.map((item) => ({
            name: item.name,
            code: item.code,
            quantity: item.quantity,
            price: Math.round(item.price),
            weight: Math.ceil(item.weight) || 500,
          })),
        },
        {
          headers: {
            Token: this.apiToken,
            ShopId: this.shopId,
            'Content-Type': 'application/json',
          },
        },
      );
      const result = response.data.data;

      return {
        waybillCode: result.order_code,
        actualFee: result.total_fee,
      };
    } catch (err: unknown) {
      let errorMsg = 'Lỗi kết nối GHN';

      const isAxiosErr =
        typeof err === 'object' && err !== null && 'isAxiosError' in err;

      if (isAxiosErr) {
        const axiosErr = err as unknown as {
          message: string;
          response?: { data?: GhnErrorResponse };
        };
        errorMsg = axiosErr.response?.data?.message || axiosErr.message;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      this.logger.error(`GHN Create Error: ${errorMsg}`);
      throw new HttpException(
        `ĐVVC báo lỗi: ${errorMsg}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // AC5: Lấy link in phiếu gửi (A5)
  async getPrintLabel(orderCode: string): Promise<string> {
    try {
      const response = await axios.post<IGhnResponse<{ token: string }>>(
        `${this.apiUrl}/a5/gen-token`,
        { order_codes: [orderCode] },
        {
          headers: {
            Token: this.apiToken,
            ShopId: this.shopId,
          },
        },
      );
      return `https://dev-online-gateway.ghn.vn/a5/public-api/printA5?token=${response.data.data.token}`;
    } catch (err: unknown) {
      let errorMsg = 'Lỗi kết nối GHN';
      const isAxiosErr =
        typeof err === 'object' && err !== null && 'isAxiosError' in err;

      if (isAxiosErr) {
        const axiosErr = err as unknown as {
          message: string;
          response?: { data?: GhnErrorResponse };
        };
        errorMsg = axiosErr.response?.data?.message || axiosErr.message;
      }

      this.logger.error(`GHN Print Label Error: ${errorMsg}`);

      throw new HttpException(
        `Lỗi từ GHN: ${errorMsg}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // AC7: Hủy đơn phía ĐVVC
  async cancelOrder(orderCode: string) {
    return axios.post(
      `${this.apiUrl}/shipping-order/cancel`,
      { order_codes: [orderCode] },
      { headers: { Token: this.apiToken, ShopId: this.shopId } },
    );
  }

  async getOrderInfo(waybillCode: string): Promise<any> {
    try {
      const response = await axios.post<IGhnResponse<any>>(
        `${this.apiUrl}/shipping-order/detail`,
        { order_code: waybillCode },
        { headers: { Token: this.apiToken } },
      );
      return response.data.data;
    } catch (err: unknown) {
      const isAxiosErr =
        typeof err === 'object' && err !== null && 'isAxiosError' in err;
      const errMsg = isAxiosErr
        ? (err as unknown as { message: string }).message
        : err instanceof Error
          ? err.message
          : 'Unknown error';

      this.logger.error(`GHN GetInfo Error: ${errMsg}`);
      throw new HttpException(
        'Không thể lấy thông tin từ GHN',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
