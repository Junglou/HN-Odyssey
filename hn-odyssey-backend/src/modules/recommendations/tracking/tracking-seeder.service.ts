import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import { TrackingService } from './tracking.service';

interface ISeedProduct {
  id: string;
  name: string;
  price: number;
}

@Injectable()
export class TrackingSeederService {
  private readonly logger = new Logger(TrackingSeederService.name);

  private readonly PRODUCTS: Record<string, ISeedProduct> = {
    KNIFE: {
      id: '6a310bdf76195a562637e8cc',
      name: 'Multi-Tool Survival Knife',
      price: 18,
    },
    SHOVEL: {
      id: '6a33e583e22e48993fd28c80',
      name: 'Wilderness Foldable Trench Shovel',
      price: 32,
    },
    FIRE_STARTER: {
      id: '6a33ef02e22e48993fd29974',
      name: 'Wilderness Magnesium Fire Starter',
      price: 12,
    },
    PARACORD: {
      id: '6a310adb76195a562637e795',
      name: 'Tactical Paracord Survival Bracelet',
      price: 12,
    },
    TENT: {
      id: '6a33e47be22e48993fd2888d',
      name: 'Stargazer 2-Person Backpacking Tent',
      price: 210,
    },

    KIDS_SHIRT: {
      id: '6a310b1f76195a562637e7fd',
      name: 'Little Adventurer UV-Block T-Shirt',
      price: 25,
    },
    KIDS_FLEECE: {
      id: '6a33dff5e22e48993fd282b9',
      name: 'Little Cub Thermal Fleece',
      price: 45,
    },
    KIDS_PANTS: {
      id: '6a33e3a4e22e48993fd28753',
      name: 'MudSkipper Convertible Trekking Pants',
      price: 35,
    },
    KIDS_HAT: {
      id: '6a33e7e0e22e48993fd28f5c',
      name: 'Cub Scout Sun Hat',
      price: 22,
    },
    WOMENS_BOOTS: {
      id: '6a31097276195a562637e540',
      name: "Trailblazer Women's Hiking Boots",
      price: 50,
    },

    LANTERN: {
      id: '6a33ef2ee22e48993fd299d5',
      name: 'Lumina Solar Camping Lantern',
      price: 34,
    },
    STOVE: {
      id: '6a33ee0ae22e48993fd297a5',
      name: 'CampChef Portable Gas Stove',
      price: 22,
    },
    COOKSET: {
      id: '6a3109f376195a562637e640',
      name: 'Ultralight Titanium Camp Cookset',
      price: 75,
    },
    BACKPACK: {
      id: '6a313e69a9668409fe17819a',
      name: 'Odyssey Expedition 65L Backpack',
      price: 80,
    },
    SLEEPING_BAG: {
      id: '6a310a4676195a562637e6cf',
      name: 'Arctic Explorer Sleeping Bag',
      price: 220,
    },
  };

  private readonly USERS = {
    HUNG: '6a54aa7acc86850d85e07c08',
    NHI: '6a54aab7cc86850d85e07caf',
    FAKE_1: '6a54aa7acc86850d85e07c11',
    FAKE_2: '6a54aa7acc86850d85e07c22',
    FAKE_3: '6a54aa7acc86850d85e07c33',
  };

  constructor(
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly trackingService: TrackingService,
  ) {}

  async seedMarketingData() {
    this.logger.log('Đang dọn dẹp dữ liệu rác cũ...');
    await this.behaviorModel.deleteMany({});
    await this.orderModel.deleteMany({ order_code: { $regex: /^SEED_/ } });

    await this.seedPythonSvdData();

    // FIX: Đã thêm AWAIT để script chờ bơm xong Data lên Server Algolia rồi mới thoát
    this.logger.log('Đang bơm data lên Algolia (Sẽ mất khoảng 15 giây)...');
    await this.seedAlgoliaInsightsBackground().catch((err) =>
      this.logger.error(`Lỗi bơm data Algolia: ${String(err)}`),
    );

    return {
      success: true,
      message:
        'Tiến trình giả lập dữ liệu hoàn tất. Đã bổ sung đa dạng User để SVD nhận diện tốt hơn.',
    };
  }

  private async seedPythonSvdData() {
    // FIX: Khai báo rõ interface để tránh các lỗi Type bất ngờ khi insert
    interface IBehaviorPayload {
      session_id: string;
      user_id: Types.ObjectId;
      action: BehaviorAction;
      path: string;
      device: DeviceType;
      metadata: { product_id: string };
      createdAt: Date;
    }
    const behaviors: IBehaviorPayload[] = [];

    const randomDate = (daysAgo: number) =>
      new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const addBehaviors = (
      userId: string,
      products: ISeedProduct[],
      device: DeviceType,
    ) => {
      products.forEach((prod) => {
        for (let i = 0; i < 6; i++) {
          behaviors.push({
            session_id: `seed_${userId}_session`,
            user_id: new Types.ObjectId(userId),
            action: BehaviorAction.VIEW_PRODUCT,
            path: `/product/${prod.id}`,
            device,
            metadata: { product_id: prod.id },
            createdAt: randomDate(Math.floor(Math.random() * 15) + 1),
          });
        }
        behaviors.push({
          session_id: `seed_${userId}_session`,
          user_id: new Types.ObjectId(userId),
          action: BehaviorAction.PURCHASE,
          path: `/checkout/success`,
          device,
          metadata: { product_id: prod.id },
          createdAt: randomDate(2),
        });
      });
    };

    // 1. KỊCH BẢN HÙNG (ĐÃ ĐỔI: CHỈ XEM ĐỒ TRẺ EM VÀ PHỤ NỮ)
    addBehaviors(
      this.USERS.HUNG,
      [
        this.PRODUCTS.KIDS_SHIRT,
        this.PRODUCTS.KIDS_FLEECE,
        this.PRODUCTS.KIDS_PANTS,
        this.PRODUCTS.KIDS_HAT,
        this.PRODUCTS.WOMENS_BOOTS,
      ],
      DeviceType.DESKTOP,
    );

    // 2. KỊCH BẢN NHI (ĐÃ ĐỔI: CHỈ XEM ĐỒ SINH TỒN)
    addBehaviors(
      this.USERS.NHI,
      [
        this.PRODUCTS.KNIFE,
        this.PRODUCTS.SHOVEL,
        this.PRODUCTS.FIRE_STARTER,
        this.PRODUCTS.PARACORD,
        this.PRODUCTS.TENT,
      ],
      DeviceType.MOBILE,
    );

    // 3. CÁC TÀI KHOẢN ẢO TẠO ĐỘ LỆCH
    addBehaviors(
      this.USERS.FAKE_1,
      [this.PRODUCTS.STOVE, this.PRODUCTS.COOKSET, this.PRODUCTS.LANTERN],
      DeviceType.TABLET,
    );
    addBehaviors(
      this.USERS.FAKE_2,
      [this.PRODUCTS.BACKPACK, this.PRODUCTS.SLEEPING_BAG, this.PRODUCTS.TENT],
      DeviceType.DESKTOP,
    );
    addBehaviors(
      this.USERS.FAKE_3,
      [this.PRODUCTS.SHOVEL, this.PRODUCTS.KNIFE, this.PRODUCTS.BACKPACK],
      DeviceType.MOBILE,
    );

    await this.behaviorModel.insertMany(behaviors);

    // Order nhắc nhở mua lại: Đã đổi sang mua chiếc Lều (TENT) để khớp với kịch bản Sinh Tồn mới của Nhi
    const seedOrder = new this.orderModel({
      order_code: `SEED_NHI_${Date.now()}`,
      user_id: new Types.ObjectId(this.USERS.NHI),
      isGuest: false,
      items: [
        {
          product_id: new Types.ObjectId(this.PRODUCTS.TENT.id),
          sku: 'ODY-EQ-STR-16-FOREST-GREEN-100', // Đã map đúng SKU thật của TENT trong cơ sở dữ liệu
          product_name: this.PRODUCTS.TENT.name,
          price: this.PRODUCTS.TENT.price,
          quantity: 1, // Lều giá trị cao nên chỉnh xuống số lượng 1
          image: '',
        },
      ],
      total_amount: this.PRODUCTS.TENT.price,
      status: 'DELIVERED',
      payment: { method: 'COD', status: 'PAID' },
      shipping_info: {
        name: 'Yến Nhi',
        phone: '0908919965',
        address: 'Quận 1',
        district_code: '1',
        ward_code: '1',
        city_code: '1',
        email: 'hungvuphi2004@gmail.com',
      },
      waybill_code: 'SEED_WB_NHI',
      actual_shipping_fee: 0,
      createdAt: randomDate(40),
    });
    await seedOrder.save();

    this.logger.log('Đã bơm đồ đa dạng để AI SVD phân loại User tốt hơn.');
  }

  private async seedAlgoliaInsightsBackground() {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 80; i++) {
      const session = `seed_guest_fbt1_${i}`;
      await this.trackingService.sendAlgoliaInsight(
        'ADD_TO_CART',
        session,
        this.PRODUCTS.TENT.id,
        'Cart',
      );
      await delay(50);
      await this.trackingService.sendAlgoliaInsight(
        'ADD_TO_CART',
        session,
        this.PRODUCTS.LANTERN.id,
        'Cart',
      );
      await delay(50);
    }

    for (let i = 0; i < 70; i++) {
      const session = `seed_guest_fbt2_${i}`;
      await this.trackingService.sendAlgoliaInsight(
        'ADD_TO_CART',
        session,
        this.PRODUCTS.STOVE.id,
        'Cart',
      );
      await delay(50);
      await this.trackingService.sendAlgoliaInsight(
        'ADD_TO_CART',
        session,
        this.PRODUCTS.COOKSET.id,
        'Cart',
      );
      await delay(50);
    }

    for (let i = 0; i < 100; i++) {
      const session = `seed_guest_related_${i}`;
      await this.trackingService.sendAlgoliaInsight(
        'VIEW',
        session,
        this.PRODUCTS.KIDS_SHIRT.id,
        'Product_Detail',
      );
      await delay(50);
      await this.trackingService.sendAlgoliaInsight(
        'VIEW',
        session,
        this.PRODUCTS.KIDS_FLEECE.id,
        'Product_Detail',
      );
      await delay(50);
      await this.trackingService.sendAlgoliaInsight(
        'VIEW',
        session,
        this.PRODUCTS.KIDS_HAT.id,
        'Product_Detail',
      );
      await delay(50);
    }

    this.logger.log(
      'Hoàn tất bơm dữ liệu lên Algolia. Vượt ngưỡng 250 Events thành công!',
    );
  }
}
