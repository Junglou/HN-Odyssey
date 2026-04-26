import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { fakerVI as faker } from '@faker-js/faker';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import * as fs from 'fs';
import * as path from 'path';

//  THÊM TYPE ĐỂ FIX LỖI ESLINT
interface IVariantAttribute {
  code: string;
  value: string;
}

interface IProductVariant {
  sku: string;
  price: number;
  sale_price: number;
  stock: number;
  attributes: IVariantAttribute[];
}

// FIX TS2430: Dùng Omit để giữ nguyên 100% Schema gốc (gồm cả gallery), chỉ ghi đè mảng variants
type IProductWithVariants = Omit<ProductDocument, 'variants'> & {
  variants: IProductVariant[];
};

//

export interface IMockOrderItem {
  product_id: Types.ObjectId;
  sku: string;
  product_name: string;
  price: number;
  quantity: number;
  image: string;
  variant_name?: string;
}

export interface IMockOrderTimeline {
  status: string;
  timestamp: Date;
  actor: string;
  note?: string;
}

export interface IMockOrder {
  order_code: string;
  user_id?: Types.ObjectId;
  guest_info?: { name: string; phone: string; email: string };
  isGuest: boolean;
  items: IMockOrderItem[];
  payment: { method: string; status: string; transaction_id: string };
  total_amount: number;
  status: string;
  discount_amount: number;
  voucher_code?: string;
  cancel_reason?: string;
  hold_expires_at?: Date;
  session_id: string;
  shipping_info: {
    name: string;
    phone: string;
    address: string;
    district_code: string;
    ward_code: string;
    city_code: string;
    email: string;
    provider: string;
    tracking_code: string;
  };
  waybill_code: string;
  actual_shipping_fee: number;
  timeline: IMockOrderTimeline[];
  internal_note?: string;
  print_count: number;
  points_used: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrderSeederService {
  private readonly logger = new Logger(OrderSeederService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async seedOrders(count: number = 2000): Promise<void> {
    this.logger.log('Đang dọn dẹp Orders cũ...');
    await this.orderModel.deleteMany({});

    // Ép kiểu an toàn (Safe type assertion) thay vì dùng "any"
    const dbProducts = (await this.productModel
      .find()
      .lean()
      .exec()) as unknown as IProductWithVariants[];

    if (dbProducts.length === 0) {
      this.logger.error(
        '❌ Không tìm thấy Product nào! Hãy chạy lệnh seed:products trước.',
      );
      return;
    }

    this.logger.log(
      `Đã tải ${dbProducts.length} sản phẩm. Bắt đầu tạo ${count} đơn hàng chuẩn AI...`,
    );
    const mockOrders: IMockOrder[] = [];
    const orderStatuses: string[] = [
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPING',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ];

    for (let i = 0; i < count; i++) {
      let total_amount = 0;
      const numItems = faker.number.int({ min: 1, max: 3 });

      const selectedProducts = faker.helpers.arrayElements(
        dbProducts,
        numItems,
      );

      const items: IMockOrderItem[] = selectedProducts.map((prod) => {
        const quantity = faker.number.int({ min: 1, max: 2 });

        let itemSku = String(prod.sku); // Đảm bảo luôn là string
        let itemPrice = Number(
          prod.sale_price > 0 ? prod.sale_price : prod.price,
        );
        let variantName: string | undefined = undefined;

        if (
          prod.has_variants &&
          prod.variants &&
          Array.isArray(prod.variants) &&
          prod.variants.length > 0
        ) {
          const randomVariant = faker.helpers.arrayElement(prod.variants);

          if (randomVariant && randomVariant.sku) {
            itemSku = String(randomVariant.sku);
            itemPrice = Number(
              randomVariant.sale_price > 0
                ? randomVariant.sale_price
                : randomVariant.price,
            );

            if (
              randomVariant.attributes &&
              Array.isArray(randomVariant.attributes) &&
              randomVariant.attributes.length > 0
            ) {
              variantName = randomVariant.attributes
                .map((attr) => String(attr.value).toUpperCase())
                .join(' - ');
            }
          }
        }

        total_amount += itemPrice * quantity;

        let itemImage = '';
        if (
          prod.gallery &&
          Array.isArray(prod.gallery) &&
          prod.gallery.length > 0 &&
          prod.gallery[0].url
        ) {
          itemImage = String(prod.gallery[0].url);
        } else if (
          prod.images &&
          Array.isArray(prod.images) &&
          prod.images.length > 0
        ) {
          itemImage = String(prod.images[0]);
        }

        return {
          product_id: new Types.ObjectId(prod._id as unknown as Types.ObjectId),
          sku: itemSku,
          product_name: String(prod.name),
          price: itemPrice,
          quantity: quantity,
          image: itemImage,
          variant_name: variantName,
        };
      });

      const isGuest = faker.datatype.boolean();
      const guestInfo = isGuest
        ? {
            name: faker.person.fullName(),
            phone: faker.phone.number(),
            email: faker.internet.email(),
          }
        : undefined;

      const userId = !isGuest ? new Types.ObjectId() : undefined;
      const currentStatus = faker.helpers.arrayElement(orderStatuses);

      const createdAt = faker.date.recent({ days: 29 });

      const timeline: IMockOrderTimeline[] = [
        {
          status: 'PENDING',
          timestamp: createdAt,
          actor: 'SYSTEM',
          note: 'Ghi nhận đơn hàng',
        },
      ];

      if (currentStatus !== 'PENDING') {
        timeline.push({
          status: currentStatus,
          timestamp: faker.date.recent({ days: 30, refDate: new Date() }),
          actor: 'ADMIN_SYSTEM',
          note: 'Cập nhật trạng thái tự động',
        });
      }

      const order: IMockOrder = {
        order_code: `HN${faker.string.alphanumeric(8).toUpperCase()}`,
        user_id: userId,
        guest_info: guestInfo,
        isGuest: isGuest,
        items: items,
        payment: {
          method: faker.helpers.arrayElement(['COD', 'VNPay']),
          status: faker.helpers.arrayElement(['PENDING', 'PAID']),
          transaction_id: faker.string.uuid(),
        },
        total_amount: total_amount,
        status: currentStatus,
        discount_amount: 0,
        session_id: faker.string.uuid(),
        shipping_info: {
          name: guestInfo?.name ?? faker.person.fullName(),
          phone: guestInfo?.phone ?? faker.phone.number(),
          address: faker.location.streetAddress(),
          district_code: 'D1',
          ward_code: 'W1',
          city_code: 'HCM',
          email: guestInfo?.email ?? faker.internet.email(),
          provider: 'GHN',
          tracking_code: faker.string.alphanumeric(10).toUpperCase(),
        },
        waybill_code: faker.string.alphanumeric(10).toUpperCase(),
        actual_shipping_fee: 30000,
        timeline: timeline,
        print_count: 0,
        points_used: 0,
        createdAt: createdAt,
        updatedAt: new Date(),
      };

      mockOrders.push(order);
    }

    try {
      await this.orderModel.insertMany(mockOrders);
      this.logger.log(
        `✅ Đã đồng bộ và insert thành công ${count} đơn hàng vào Database (Đã xử lý đúng SKU Variants).`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi khi insert order mock data:', error);
    }
  }

  async exportToAlgoliaCSV(): Promise<void> {
    const orders = await this.orderModel
      .find({ status: { $ne: 'CANCELLED' } })
      .exec();

    this.logger.log(
      `Bắt đầu lọc và chuyển đổi ${orders.length} đơn hàng sang định dạng CSV chuẩn Algolia...`,
    );

    let csvContent = 'userToken,timestamp,objectID,eventType,eventName\n';
    let validRowsCount = 0;

    for (const order of orders) {
      if (order.items.length < 2) continue;

      const userToken =
        order.user_id?.toString() || order.session_id || 'guest-user';
      const timestamp = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();
      const eventType = 'conversion';
      const eventName = 'Order Completed';

      for (const item of order.items) {
        const objectID = item.product_id.toString();
        csvContent += `${userToken},${timestamp},${objectID},${eventType},${eventName}\n`;
        validRowsCount++;
      }
    }

    const filePath = path.join(process.cwd(), 'algolia_events.csv');
    fs.writeFileSync(filePath, csvContent, 'utf8');

    this.logger.log(
      `✅ Đã xuất thành công ${validRowsCount} dòng dữ liệu vào file: ${filePath}`,
    );
    this.logger.log(
      `⚠️ Lưu ý: File này giờ đã có cột 'objectID' đúng chuẩn Dashboard yêu cầu.`,
    );
  }
}
