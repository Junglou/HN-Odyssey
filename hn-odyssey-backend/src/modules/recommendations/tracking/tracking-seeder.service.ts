import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  AdCampaign,
  AdCampaignDocument,
} from 'src/modules/marketing/campaigns/schemas/ad-campaign.schema';
import {
  Coupon,
  CouponDocument,
} from 'src/modules/marketing/promotions/schemas/coupon.schema';

@Injectable()
export class TrackingSeederService {
  private readonly logger = new Logger(TrackingSeederService.name);

  constructor(
    @InjectModel(AdCampaign.name)
    private campaignModel: Model<AdCampaignDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async seedMarketingData() {
    this.logger.log('Bắt đầu dọn dẹp dữ liệu Marketing & BI cũ...');
    await this.campaignModel.deleteMany({ name: { $regex: /\[TEST\]/ } });
    await this.couponModel.deleteMany({ code: { $regex: /TEST_/ } });
    await this.behaviorModel.deleteMany({ source: 'SEEDER' });
    await this.orderModel.deleteMany({ order_code: { $regex: /SEED_/ } });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    this.logger.log('Đang tạo 15 Ad Campaigns (Chuẩn ngân sách USD)...');
    const campaignPayloads = Array.from({ length: 15 }).map((_, i) => ({
      name: `[TEST] Campaign ${i + 1} - ${Math.random().toString(36).substring(7).toUpperCase()}`,
      status: i % 4 === 0 ? 'PAUSED' : 'ACTIVE',
      budget: 1000 + i * 500, // Budget tầm $1000 - $8000
      ad_spend: 300 + i * 400, // Spend tầm $300 - $6000
      utm_campaign: `test_camp_${i + 1}`,
      utm_source: i % 2 === 0 ? 'facebook' : 'google',
      utm_medium: 'cpc',
      start_date: thirtyDaysAgo,
      end_date: thirtyDaysFuture,
    }));
    const campaigns = await this.campaignModel.insertMany(campaignPayloads);

    this.logger.log('Đang tạo 15 Coupons...');
    const couponPayloads = Array.from({ length: 15 }).map((_, i) => ({
      code: `TEST_CPN_${i + 1}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      description: `Giảm giá đợt ${i + 1}`,
      status: 'ACTIVE',
      start_date: thirtyDaysAgo,
      end_date: thirtyDaysFuture,
      discount_type: i % 2 === 0 ? 'PERCENTAGE' : 'FIXED_AMOUNT',
      // Nếu là $ cố định thì giảm $10 - $50, nếu là % thì 10% - 30%
      discount_value: i % 2 === 0 ? 10 + (i % 3) * 10 : 10 + i * 5,
      usage_limit: 500 + i * 50,
    }));
    const coupons = await this.couponModel.insertMany(couponPayloads);

    this.logger.log(
      'Đang tạo 300 Sessions chuẩn hóa Phễu và Khách hàng cho màn hình BI...',
    );

    // TẠO NHÓM USER ĐỂ TEST "RETURNING CUSTOMER"
    const mockUsers = Array.from({ length: 15 }).map(
      () => new Types.ObjectId(),
    );

    for (let i = 0; i < 300; i++) {
      const sessionId = `seed_session_${new Types.ObjectId().toString()}`;
      const randomDate = new Date(
        thirtyDaysAgo.getTime() +
          Math.random() * (now.getTime() - thirtyDaysAgo.getTime()),
      );

      // 40% là khách hàng cũ (có user_id) để biểu đồ Retention hiện số đẹp
      const isMember = Math.random() > 0.6;
      const userId = isMember
        ? mockUsers[Math.floor(Math.random() * mockUsers.length)]
        : undefined;

      const camp = campaigns[Math.floor(Math.random() * campaigns.length)];
      const coup = coupons[Math.floor(Math.random() * coupons.length)];

      // Tỷ lệ rụng của Phễu chuyển đổi (Funnel)
      const isAddToCart = Math.random() > 0.4; // 60% thêm vào giỏ
      const isCheckout = isAddToCart && Math.random() > 0.4; // Chuyển sang thanh toán
      const isPurchased = isCheckout && Math.random() > 0.3; // Mua thành công

      const baseMetadata = {
        utm_campaign: camp.utm_campaign,
        utm_source: camp.utm_source,
        utm_medium: camp.utm_medium,
        voucher_code: coup.code,
      };

      // Tầng 1: VIEW (Chắc chắn có)
      await this.behaviorModel.create({
        session_id: sessionId,
        user_id: userId,
        action: BehaviorAction.VIEW_PRODUCT,
        device: Math.random() > 0.5 ? DeviceType.DESKTOP : DeviceType.MOBILE,
        path: '/product/test',
        source: 'SEEDER',
        dwell_time_seconds: Math.floor(Math.random() * 120),
        metadata: baseMetadata,
        createdAt: randomDate,
      });

      // Tầng 2: ADD TO CART
      if (isAddToCart) {
        await this.behaviorModel.create({
          session_id: sessionId,
          user_id: userId,
          action: BehaviorAction.ADD_TO_CART,
          path: '/cart',
          source: 'SEEDER',
          metadata: baseMetadata,
          createdAt: new Date(randomDate.getTime() + 1000),
        });
      }

      // Tầng 3: BEGIN CHECKOUT
      if (isCheckout) {
        await this.behaviorModel.create({
          session_id: sessionId,
          user_id: userId,
          action: BehaviorAction.BEGIN_CHECKOUT,
          path: '/checkout',
          source: 'SEEDER',
          metadata: baseMetadata,
          createdAt: new Date(randomDate.getTime() + 3000),
        });
      }

      // Tầng 4: PURCHASE
      if (isPurchased) {
        await this.behaviorModel.create({
          session_id: sessionId,
          user_id: userId,
          action: BehaviorAction.PURCHASE,
          path: '/checkout/success',
          source: 'SEEDER',
          metadata: baseMetadata,
          createdAt: new Date(randomDate.getTime() + 5000),
        });

        // Giá trị đơn hàng chuẩn USD: $80 - $450
        const orderTotal = 80 + Math.floor(Math.random() * 370);
        const discountAmt = Math.floor(orderTotal * 0.15); // Giảm tầm 15%

        await this.orderModel.create({
          session_id: sessionId,
          user_id: userId,
          order_code: `SEED_ORD_${Math.floor(Math.random() * 100000)}`,
          status: 'COMPLETED',
          total_amount: orderTotal,
          discount_amount: discountAmt,
          voucher_code: coup.code,
          campaign_id: camp._id,
          createdAt: new Date(randomDate.getTime() + 5000),
          items: [
            {
              product_id: new Types.ObjectId(),
              sku: 'TEST_SKU',
              product_name: 'Odyssey Pro Shoes',
              price: orderTotal,
              quantity: 1,
            },
          ],
        });
      }
    }

    this.logger.log(
      '✅ Hoàn tất bơm dữ liệu Seed chuẩn USD cho Marketing & BI!',
    );
    return {
      success: true,
      message: 'Seeded Advanced Marketing & BI Data Successfully',
    };
  }
}
