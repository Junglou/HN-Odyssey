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
  codAmount: number;
  wardCode: string;
  districtId: number;
  items: IShippingItem[];
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
    console.log('=== CHECK SHOP ID ===', this.shopId); // Kiểm tra xem lấy ShopID chưa

    try {
      // Chỉ định kiểu trả về của Axios là IGhnResponse<GhnCreateOrderResponse>
      const response = await axios.post<IGhnResponse<GhnCreateOrderResponse>>(
        `${this.apiUrl}/shipping-order/create`,
        {
          payment_type_id: 2,
          service_type_id: 2,
          note: orderData.note || 'Hàng dễ vỡ',
          required_note: 'CHOXEMHANGKHONGTHU',
          to_name: orderData.customerName,
          to_phone: orderData.phone,
          to_address: orderData.address,
          to_ward_code: orderData.wardCode,
          to_district_id: orderData.districtId,
          weight: Math.ceil(orderData.weight * 1000),
          cod_amount: orderData.codAmount,

          items: orderData.items.map((item) => ({
            name: item.name,
            code: item.code,
            quantity: item.quantity,
            price: item.price,
            weight: Math.ceil(item.weight * 1000) || 500, // Đổi kg ra gram
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

      // Kiểm tra thủ công thay vì dùng isAxiosError để tránh lỗi "Unsafe call"
      const isAxiosErr =
        typeof err === 'object' && err !== null && 'isAxiosError' in err;

      if (isAxiosErr) {
        // Ép kiểu qua unknown rồi mới sang ISafeAxiosError (Duck-typing)
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
        { headers: { Token: this.apiToken } },
      );
      return `https://dev-online-gateway.ghn.vn/a5/public-api/print/${response.data.data.token}`;
    } catch (err: unknown) {
      const isAxiosErr =
        typeof err === 'object' && err !== null && 'isAxiosError' in err;
      const errMsg = isAxiosErr
        ? (err as unknown as { message: string }).message
        : 'Unknown error';

      this.logger.error(`GHN Error: ${errMsg}`);
      throw new HttpException(
        'Không thể thực hiện thao tác với GHN',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // AC7: Hủy đơn phía ĐVVC
  async cancelOrder(orderCode: string) {
    return axios.post(
      `${this.apiUrl}/shipping-order/cancel`,
      { order_codes: [orderCode] },
      { headers: { Token: this.apiToken, ShopId: this.shopId } }, // Nhớ truyền cả ShopId khi hủy đơn
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
