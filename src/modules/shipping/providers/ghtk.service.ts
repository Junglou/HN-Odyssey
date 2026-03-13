import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ShippingService } from '../shipping.service';

// 1. Định nghĩa Interface cho dữ liệu đầu vào
interface IGhtkItem {
  name: string;
  weight: number;
  quantity: number;
}

interface IGhtkOrderInput {
  orderCode: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  ward: string;
  codAmount: number;
  totalValue: number;
  items: IGhtkItem[];
}

// 2. Định nghĩa Interface cho dữ liệu phản hồi từ GHTK
interface IGhtkResponse {
  success: boolean;
  message?: string;
  order?: {
    label: string;
    fee: number;
  };
}

@Injectable()
export class GhtkService {
  private readonly logger = new Logger(GhtkService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private configService: ConfigService,
    private shippingService: ShippingService,
  ) {
    this.apiUrl = 'https://services-staging.ghtklab.com/services/shipment';
    this.apiToken = this.configService.get<string>('GHTK_TOKEN') ?? '';
  }

  private async getActiveToken(): Promise<string> {
    const config = await this.shippingService.getDefaultConfig();
    return (
      config?.ghtk_config?.token ||
      this.configService.get<string>('GHTK_TOKEN') ||
      ''
    );
  }

  async createShippingOrder(orderData: IGhtkOrderInput) {
    try {
      const token = await this.getActiveToken(); // 2. Lấy token động

      const response = await axios.post<IGhtkResponse>(
        `${this.apiUrl}/order`,
        {
          products: orderData.items.map((item) => ({
            name: item.name,
            weight: item.weight,
            quantity: item.quantity,
          })),
          order: {
            id: orderData.orderCode,
            pick_name: 'H&N Odyssey Store',
            pick_address: '217 Đ. Đặng Thuỳ Trâm',
            pick_province: 'Thành phố Hồ Chí Minh', // Phải khớp với mapping GHTK
            pick_district: 'Quận Bình Thạnh', // Phải khớp với mapping GHTK
            pick_tel: '098919964',
            tel: orderData.phone,
            name: orderData.customerName,
            address: orderData.address,
            province: orderData.city,
            district: orderData.district,
            ward: orderData.ward,
            hamlet: 'Khác',
            is_freeship: '1',
            posting_model: 'v2',
            amount: orderData.codAmount,
            value: orderData.totalValue,
          },
        },
        {
          headers: {
            Token: token,
            'X-Client-Source': 'S308157', // Thêm cái này để GHTK Staging nhận diện partner
          },
        },
      );

      const result = response.data;
      if (!result.success) {
        throw new Error(result.message || 'Lỗi không xác định từ GHTK');
      }

      return {
        waybillCode: result.order?.label || '',
        actualFee: result.order?.fee || 0,
      };
    } catch (error) {
      // Xử lý lỗi an toàn cho biến 'error'
      let errorMessage = 'Lỗi kết nối GHTK';

      if (error instanceof AxiosError) {
        // Lấy message từ response của GHTK nếu có
        const ghtkData = error.response?.data as IGhtkResponse | undefined;
        errorMessage = ghtkData?.message || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error(`GHTK Create Error: ${errorMessage}`);
      throw new HttpException(
        `ĐVVC GHTK báo lỗi: ${errorMessage}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // AC4: Lấy thông tin trạng thái mới nhất từ GHTK
  async getOrderInfo(label: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/v2/tracking/${label}`, {
        headers: { Token: this.apiToken },
      });
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GHTK GetInfo Error: ${errorMessage}`);
      throw new HttpException(
        'Không thể lấy thông tin từ GHTK',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // AC5: Lấy link in phiếu gửi GHTK
  async getPrintLabel(label: string): Promise<string> {
    // GHTK hỗ trợ in trực tiếp trên nền tảng web của họ thông qua alias code
    return `https://khachhang-staging.ghtklab.com/khachhang?code=${label}`;
  }

  async cancelOrder(label: string) {
    return axios.post(
      `${this.apiUrl}/cancel/${label}`,
      {},
      { headers: { Token: this.apiToken } },
    );
  }
}
