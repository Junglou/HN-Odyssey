import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose'; // <-- Thêm InjectConnection
import { Model, Types, Connection } from 'mongoose'; // <-- Thêm Connection
import { fakerVI as faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';

// Import Schemas
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  ProductVariant,
  VariantAttribute,
} from 'src/modules/products/catalog/schemas/product-variant.schema';
import { Customer } from 'src/modules/users/customers/schemas/customer.schema';

// Khai báo Interfaces định dạng kiểu dữ liệu
interface IOrderShippingInfo {
  name: string;
  phone: string;
  address: string;
  district_code: string;
  ward_code: string;
  city_code: string;
  email?: string;
  provider?: string;
  tracking_code?: string;
}

interface IGuestInfo {
  name: string;
  phone: string;
  email?: string;
}

interface ICustomerData extends Customer {
  // Chỉ thêm các thuộc tính mở rộng (nếu có)
  _id: Types.ObjectId;
}

@Injectable()
export class OrderSeederService {
  private readonly logger = new Logger(OrderSeederService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectConnection() private readonly connection: Connection, // <-- Dùng Connection thay vì InjectModel Customer
  ) {}

  async seedOrders(count: number = 2000): Promise<void> {
    this.logger.log('Đang dọn dẹp collection Orders cũ...');
    await this.orderModel.deleteMany({});

    // Gọi model Customer linh động từ connection đã được compile ở UsersModule
    const customerModel = this.connection.model(Customer.name);

    // 1. Fetch dữ liệu thực từ DB
    const dbProducts = (await this.productModel
      .find()
      .lean()
      .exec()) as unknown as ProductDocument[];
    const dbCustomers = (await customerModel
      .find()
      .lean()
      .exec()) as unknown as ICustomerData[];

    if (dbProducts.length === 0) {
      this.logger.error(
        'Không tìm thấy Product. Hãy chạy seed:products trước.',
      );
      return;
    }

    // 2. Phân cụm sản phẩm theo Category
    const productsByCategory: Record<string, ProductDocument[]> = {};
    dbProducts.forEach((product: ProductDocument) => {
      const catId =
        product.categories && product.categories.length > 0
          ? (product.categories[0] as unknown as Types.ObjectId).toHexString()
          : 'uncategorized';

      if (!productsByCategory[catId]) {
        productsByCategory[catId] = [];
      }
      productsByCategory[catId].push(product);
    });

    const mockOrders: Partial<Order>[] = [];

    for (let i = 0; i < count; i++) {
      let total_amount = 0;
      const numItems = faker.number.int({ min: 1, max: 4 });
      const selectedProducts: ProductDocument[] = [];

      // 3. Logic chọn sản phẩm mua kèm
      const anchorProduct = faker.helpers.arrayElement(dbProducts);
      selectedProducts.push(anchorProduct);

      if (numItems > 1) {
        const catId =
          anchorProduct.categories && anchorProduct.categories.length > 0
            ? (
                anchorProduct.categories[0] as unknown as Types.ObjectId
              ).toHexString()
            : 'uncategorized';

        const relatedProducts = productsByCategory[catId].filter(
          (p: ProductDocument) =>
            p._id.toString() !== anchorProduct._id.toString(),
        );

        if (relatedProducts.length > 0) {
          const additionalCount = Math.min(
            numItems - 1,
            relatedProducts.length,
          );
          const additionalItems = faker.helpers.arrayElements(
            relatedProducts,
            additionalCount,
          );
          selectedProducts.push(...additionalItems);
        }
      }

      // 4. Ánh xạ thành OrderItems chuẩn Schema
      const items = selectedProducts.map((prod: ProductDocument) => {
        const quantity = faker.number.int({ min: 1, max: 3 });
        let itemSku = String(prod.sku);
        let itemPrice = Number(
          prod.sale_price > 0 ? prod.sale_price : prod.price,
        );
        let variantName: string | undefined = undefined;

        if (
          prod.has_variants &&
          Array.isArray(prod.variants) &&
          prod.variants.length > 0
        ) {
          const validVariants = prod.variants.filter(
            (v: ProductVariant) => v.active,
          );
          const variant: ProductVariant =
            validVariants.length > 0
              ? faker.helpers.arrayElement(validVariants)
              : prod.variants[0];

          if (variant && variant.sku) {
            itemSku = String(variant.sku);
            itemPrice = Number(
              variant.sale_price > 0 ? variant.sale_price : variant.price,
            );

            if (
              Array.isArray(variant.attributes) &&
              variant.attributes.length > 0
            ) {
              variantName = variant.attributes
                .map((attr: VariantAttribute) =>
                  String(attr.value).toUpperCase(),
                )
                .join(' - ');
            }
          }
        }

        total_amount += itemPrice * quantity;

        let itemImage = '';
        if (Array.isArray(prod.gallery) && prod.gallery.length > 0) {
          const imgMedia = prod.gallery.find((m) => m.type === 'IMAGE');
          itemImage = imgMedia
            ? String(imgMedia.url)
            : String(prod.gallery[0].url);
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

      // 5. Đồng bộ User thực tế
      const isGuest =
        dbCustomers.length === 0 ? true : faker.datatype.boolean();
      let userId: Types.ObjectId | undefined = undefined;
      let guestInfo: IGuestInfo | undefined = undefined;
      let shippingInfo: IOrderShippingInfo;

      if (!isGuest && dbCustomers.length > 0) {
        const selectedUser = faker.helpers.arrayElement(dbCustomers);
        userId = new Types.ObjectId(
          selectedUser._id as unknown as Types.ObjectId,
        );
        const fallbackName =
          `${selectedUser.first_Name || ''} ${selectedUser.last_Name || ''}`.trim();

        if (
          Array.isArray(selectedUser.addresses) &&
          selectedUser.addresses.length > 0
        ) {
          const address =
            selectedUser.addresses.find((a) => a.is_default) ||
            selectedUser.addresses[0];
          shippingInfo = {
            name: String(
              address.name || fallbackName || faker.person.fullName(),
            ),
            phone: String(
              address.phone || selectedUser.phone || faker.phone.number(),
            ),
            address: String(address.street || faker.location.streetAddress()),
            district_code: String(address.district_code || 'D1'),
            ward_code: String(address.ward_code || 'W1'),
            city_code: String(address.city_code || 'HCM'),
            email: selectedUser.email
              ? String(selectedUser.email)
              : faker.internet.email(),
            provider: 'GHN',
            tracking_code: faker.string.alphanumeric(10).toUpperCase(),
          };
        } else {
          shippingInfo = {
            name: String(fallbackName || faker.person.fullName()),
            phone: String(selectedUser.phone || faker.phone.number()),
            address: faker.location.streetAddress(),
            district_code: 'D1',
            ward_code: 'W1',
            city_code: 'HCM',
            email: selectedUser.email
              ? String(selectedUser.email)
              : faker.internet.email(),
            provider: 'GHN',
            tracking_code: faker.string.alphanumeric(10).toUpperCase(),
          };
        }
      } else {
        guestInfo = {
          name: faker.person.fullName(),
          phone: faker.phone.number(),
          email: faker.internet.email(),
        };
        shippingInfo = {
          name: guestInfo.name,
          phone: guestInfo.phone,
          address: faker.location.streetAddress(),
          district_code: 'D1',
          ward_code: 'W1',
          city_code: 'HCM',
          email: guestInfo.email,
          provider: 'GHN',
          tracking_code: faker.string.alphanumeric(10).toUpperCase(),
        };
      }

      // 6. Xây dựng Status & Timeline
      const currentStatus = faker.helpers.weightedArrayElement([
        { weight: 60, value: 'COMPLETED' },
        { weight: 20, value: 'DELIVERED' },
        { weight: 10, value: 'CANCELLED' },
        { weight: 5, value: 'PROCESSING' },
        { weight: 5, value: 'PENDING' },
      ]);

      const createdAtDate = faker.date.recent({ days: 90 });
      const timestampMs = new Date(createdAtDate).getTime();

      const timeline = [
        {
          status: 'PENDING',
          timestamp: createdAtDate,
          actor: 'SYSTEM',
          note: 'Hệ thống ghi nhận đơn hàng mới',
        },
      ];

      if (currentStatus !== 'PENDING') {
        const processTime = new Date(
          timestampMs + faker.number.int({ min: 3600000, max: 86400000 }),
        );
        timeline.push({
          status: 'PROCESSING',
          timestamp: processTime,
          actor: 'ADMIN',
          note: 'Đang xử lý đóng gói',
        });

        if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(currentStatus)) {
          const finalTime = new Date(
            processTime.getTime() +
              faker.number.int({ min: 86400000, max: 259200000 }),
          );
          timeline.push({
            status: currentStatus,
            timestamp: finalTime,
            actor: currentStatus === 'CANCELLED' ? 'CUSTOMER' : 'SYSTEM',
            note: `Cập nhật trạng thái: ${currentStatus}`,
          });
        }
      }

      mockOrders.push({
        order_code: `ORD-${timestampMs}-${faker.string.alphanumeric(4).toUpperCase()}`,
        user_id: userId,
        guest_info: guestInfo,
        isGuest: isGuest,
        items: items,
        payment: {
          method: faker.helpers.arrayElement(['COD', 'VNPay', 'Momo']),
          status: ['COMPLETED', 'DELIVERED'].includes(currentStatus)
            ? 'PAID'
            : 'PENDING',
          transaction_id: faker.string.uuid(),
        },
        total_amount: total_amount,
        status: currentStatus,
        discount_amount: 0,
        voucher_code: faker.datatype.boolean()
          ? faker.string.alphanumeric(6).toUpperCase()
          : '',
        cancel_reason:
          currentStatus === 'CANCELLED' ? 'Khách hàng đổi ý' : undefined,
        session_id: faker.string.uuid(),
        shipping_info: shippingInfo,
        waybill_code: faker.string.alphanumeric(10).toUpperCase(),
        actual_shipping_fee: faker.helpers.arrayElement([25000, 30000, 35000]),
        timeline: timeline,
        internal_note: faker.datatype.boolean()
          ? 'Đơn hàng tạo từ AI Seeder'
          : '',
        print_count: faker.helpers.arrayElement([0, 1, 2]),
        points_used: 0,
        createdAt: createdAtDate,
        updatedAt: timeline[timeline.length - 1].timestamp,
      });
    }

    await this.orderModel.insertMany(mockOrders);
    this.logger.log(`Hoàn tất insert ${count} đơn hàng vào Database.`);
  }

  async exportToAlgoliaCSV(): Promise<void> {
    const orders = (await this.orderModel
      .find()
      .lean()
      .exec()) as unknown as OrderDocument[];
    let csvContent = 'userToken,timestamp,objectID,eventType,eventName\n';
    let validRowsCount = 0;

    for (const order of orders) {
      const userToken = order.user_id
        ? String(order.user_id)
        : order.session_id || 'guest-user';
      const orderTimestamp = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();

      for (const item of order.items) {
        const objectID = String(item.product_id);

        const viewTimestamp =
          orderTimestamp - faker.number.int({ min: 300000, max: 3600000 });
        csvContent += `${userToken},${viewTimestamp},${objectID},view,Product Viewed\n`;
        validRowsCount++;

        const cartTimestamp =
          orderTimestamp - faker.number.int({ min: 60000, max: 290000 });
        csvContent += `${userToken},${cartTimestamp},${objectID},click,Added To Cart\n`;
        validRowsCount++;

        if (
          ['COMPLETED', 'DELIVERED', 'SHIPPING', 'READY_TO_SHIP'].includes(
            order.status,
          )
        ) {
          csvContent += `${userToken},${orderTimestamp},${objectID},conversion,Order Completed\n`;
          validRowsCount++;
        }
      }
    }

    const filePath = path.join(process.cwd(), 'algolia_events.csv');
    fs.writeFileSync(filePath, csvContent, 'utf8');
    this.logger.log(
      `Đã xuất ${validRowsCount} dòng sự kiện ra file CSV cho Algolia.`,
    );
  }
}
