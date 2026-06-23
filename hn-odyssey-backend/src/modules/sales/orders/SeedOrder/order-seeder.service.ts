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

type IProductWithVariants = Omit<ProductDocument, 'variants'> & {
  variants: IProductVariant[];
};

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

    const dbProducts = (await this.productModel
      .find()
      .lean()
      .exec()) as unknown as IProductWithVariants[];

    if (dbProducts.length === 0) {
      this.logger.error(
        'Không tìm thấy Product. Hãy chạy seed:products trước.',
      );
      return;
    }

    const mockOrders: IMockOrder[] = [];

    for (let i = 0; i < count; i++) {
      let total_amount = 0;
      const numItems = faker.number.int({ min: 1, max: 3 });

      const selectedProducts = faker.helpers.arrayElements(
        dbProducts,
        numItems,
      );

      const items: IMockOrderItem[] = selectedProducts.map((prod) => {
        const quantity = faker.number.int({ min: 1, max: 2 });
        let itemSku = String(prod.sku);
        let itemPrice = Number(
          prod.sale_price > 0 ? prod.sale_price : prod.price,
        );
        let variantName: string | undefined = undefined;

        // Xử lý lấy thông tin Variant đồng nhất 100% với tệp sản phẩm gốc để loại bỏ đứt gãy biến thể
        if (
          prod.has_variants &&
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
        const itemImage =
          Array.isArray(prod.gallery) && prod.gallery.length > 0
            ? String(prod.gallery[0].url)
            : '';

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
      // Tăng tỷ lệ đơn thành công để tạo mẫu đối chứng chất lượng
      const currentStatus = faker.helpers.weightedArrayElement([
        { weight: 60, value: 'COMPLETED' },
        { weight: 20, value: 'DELIVERED' },
        { weight: 10, value: 'CANCELLED' },
        { weight: 10, value: 'PENDING' },
      ]);

      const createdAt = faker.date.recent({ days: 29 });
      const timestamp = new Date(createdAt).getTime();

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
          note: 'Cập nhật trạng thái',
        });
      }

      mockOrders.push({
        order_code: `ORD-${timestamp}-${faker.string.alphanumeric(4).toUpperCase()}`,
        user_id: userId,
        guest_info: guestInfo,
        isGuest: isGuest,
        items: items,
        payment: {
          method: faker.helpers.arrayElement(['COD', 'VNPay']),
          status: ['COMPLETED', 'DELIVERED'].includes(currentStatus)
            ? 'PAID'
            : 'PENDING',
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
      });
    }

    await this.orderModel.insertMany(mockOrders);
    this.logger.log(`Đã insert ${count} đơn hàng vào Database.`);
  }

  async exportToAlgoliaCSV(): Promise<void> {
    const orders = await this.orderModel.find().exec();
    let csvContent = 'userToken,timestamp,objectID,eventType,eventName\n';
    let validRowsCount = 0;

    for (const order of orders) {
      const userToken =
        order.user_id?.toString() || order.session_id || 'guest-user';
      const orderTimestamp = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();

      // Phân tách hành vi tương tác cho thuật toán học (view -> add_to_cart -> purchase)
      for (const item of order.items) {
        const objectID = item.product_id.toString(); // Ép kiểu chuỗi để loại bỏ ObjectID BSON

        // 1. Luôn ghi nhận hành vi xem sản phẩm (khám phá)
        const viewTimestamp =
          orderTimestamp - faker.number.int({ min: 300000, max: 3600000 });
        csvContent += `${userToken},${viewTimestamp},${objectID},view,Product Viewed\n`;
        validRowsCount++;

        // 2. Luôn ghi nhận hành vi thêm vào giỏ hàng
        const cartTimestamp =
          orderTimestamp - faker.number.int({ min: 60000, max: 290000 });
        csvContent += `${userToken},${cartTimestamp},${objectID},click,Added To Cart\n`;
        validRowsCount++;

        // 3. Chỉ ghi nhận sự kiện chuyển đổi (conversion) nếu đơn hàng đã thành công (Loại bỏ nhiễu)
        if (['COMPLETED', 'DELIVERED', 'SHIPPING'].includes(order.status)) {
          csvContent += `${userToken},${orderTimestamp},${objectID},conversion,Order Completed\n`;
          validRowsCount++;
        }
      }
    }

    const filePath = path.join(process.cwd(), 'algolia_events.csv');
    fs.writeFileSync(filePath, csvContent, 'utf8');
    this.logger.log(
      `Đã xuất ${validRowsCount} dòng sự kiện (views/clicks/conversions) ra file: ${filePath}`,
    );
  }
}
