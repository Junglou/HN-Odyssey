import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Banner,
  BannerStatus,
} from 'src/modules/marketing/content/schemas/banner.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import {
  UserBehavior,
  BehaviorAction,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import {
  Coupon,
  CouponStatus,
  DiscountType,
} from 'src/modules/marketing/promotions/schemas/coupon.schema';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from 'src/modules/notifications/schemas/notification-log.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';

// 1. Khai báo Interface chuẩn xác (Strict Typing)
export interface IPersonalizedBanner {
  id: string;
  title: string;
  image_pc: string;
  image_mobile: string;
  link: string;
  ab_test_group?: 'A' | 'B';
}

interface ICartItemPopulated {
  product_id: {
    _id: Types.ObjectId;
    name: string;
    thumbnail: string;
  };
  quantity: number;
}

interface IInactiveUserAggregation {
  _id: Types.ObjectId;
  last_active: Date;
}

export interface ICouponAssignedEvent {
  user_id: string | Types.ObjectId;
  email: string;
  full_name: string;
  coupon_code: string;
  discount_value: number;
  discount_type: DiscountType;
  reason: string; // Ví dụ: 'Sinh nhật', 'Xin lỗi sự cố', 'Hoàn tiền'
}

@Injectable()
export class PersonalizedMarketingService {
  private readonly logger = new Logger(PersonalizedMarketingService.name);

  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<Banner>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(UserBehavior.name) private behaviorModel: Model<UserBehavior>,
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // AC1, AC4, AC5, AC6, AC7, AC8: RULE ENGINE & BANNER CÁ NHÂN HÓA

  async getDynamicHomepageBanners(
    userId?: string,
    sessionId?: string,
  ): Promise<IPersonalizedBanner[]> {
    let isVip = false;
    let isNewbie = true;
    let isWinBackTarget = false;
    let preferredCategory: string | null = null;

    if (userId && Types.ObjectId.isValid(userId)) {
      const user = await this.customerModel.findById(userId).lean();
      if (user) {
        isVip =
          user.loyalty?.tier === 'GOLD' || user.loyalty?.tier === 'DIAMOND';
        isNewbie = user.loyalty?.total_spent === 0;

        // AC1: Trích xuất sở thích danh mục
        if (user.search_preferences?.last_filters?.category) {
          preferredCategory = String(
            user.search_preferences.last_filters.category,
          );
        }

        // AC5 (Win-back Banner Logic): Kiểm tra xem đây có phải là phiên quay lại sau 30 ngày không
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Tìm hành vi gần nhất (phiên hiện tại) và hành vi trước đó
        const recentBehaviors = await this.behaviorModel
          .find({ user_id: new Types.ObjectId(userId) })
          .sort({ createdAt: -1 })
          .limit(2)
          .select('createdAt')
          .lean();

        // Nếu hành vi trước đó (recentBehaviors[1]) đã xảy ra quá 30 ngày -> Đánh dấu là Win-back
        if (recentBehaviors.length === 2) {
          const previousSessionDate = recentBehaviors[1].createdAt;
          if (previousSessionDate < thirtyDaysAgo) {
            isWinBackTarget = true;
          }
        }
      }
    }

    const activeBanners = await this.bannerModel
      .find({
        position: 'HOME_HERO',
        status: BannerStatus.ACTIVE,
        is_deleted: false,
      })
      .lean();

    const selectedBanners: IPersonalizedBanner[] = [];

    for (const banner of activeBanners) {
      const ruleTarget = banner.title.toUpperCase();

      // AC6: Rule Engine (Phân khúc)
      if (ruleTarget.includes('[VIP]') && !isVip) continue;
      if (ruleTarget.includes('[NEWBIE]') && !isNewbie) continue;

      // AC5: Banner dành riêng cho khách quay lại
      if (ruleTarget.includes('[WINBACK]') && !isWinBackTarget) continue;

      // AC1: Dynamic Category Banner
      if (
        banner.category_id &&
        preferredCategory &&
        banner.category_id.toString() !== preferredCategory
      ) {
        continue;
      }

      // AC8: A/B Testing (Phân bổ traffic)
      let group: 'A' | 'B' | undefined = undefined;
      if (ruleTarget.includes('[AB_TEST]')) {
        const lastChar = (sessionId || userId || '0').slice(-1);
        group = parseInt(lastChar, 16) % 2 === 0 ? 'A' : 'B';

        if (ruleTarget.includes('[TEST_A]') && group === 'B') continue;
        if (ruleTarget.includes('[TEST_B]') && group === 'A') continue;
      }

      selectedBanners.push({
        id: banner._id.toString(),
        title: banner.title,
        image_pc: banner.image_pc,
        image_mobile: banner.image_mobile,
        link: banner.link,
        ab_test_group: group,
      });
    }

    // AC7: Fallback Content (Nếu không có banner nào khớp)
    if (selectedBanners.length === 0) {
      const defaultBanner = activeBanners.find((b) =>
        b.title.includes('[DEFAULT]'),
      );
      if (defaultBanner) {
        selectedBanners.push({
          id: defaultBanner._id.toString(),
          title: defaultBanner.title,
          image_pc: defaultBanner.image_pc,
          image_mobile: defaultBanner.image_mobile,
          link: defaultBanner.link,
        });
      }
    }

    return selectedBanners;
  }

  // AC3: ABANDONED CART (Lắng nghe sự kiện Bỏ quên giỏ hàng)

  @OnEvent('tracking.cart.abandoned')
  async handleAbandonedCart(payload: {
    cart_id: Types.ObjectId;
    user_id?: Types.ObjectId;
  }) {
    if (!payload.user_id) return;

    const user = await this.customerModel.findById(payload.user_id).lean();
    const cart = await this.cartModel
      .findById(payload.cart_id)
      .populate('items.product_id', 'name thumbnail')
      .lean();

    if (user && cart && cart.items.length > 0) {
      const populatedItems = cart.items as unknown as ICartItemPopulated[];

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #ddd;">
          <h2 style="color: #333;">Chào ${user.fullName}, bạn quên gì đó ư?</h2>
          <p>Giỏ hàng của bạn đang có <b>${populatedItems.length}</b> sản phẩm cực kỳ hấp dẫn đang chờ được thanh toán. Hoàn tất ngay để nhận FreeShip nhé!</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            ${populatedItems
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;"><img src="${item.product_id.thumbnail}" width="60" style="border-radius: 4px;" /></td>
                <td style="padding: 10px; font-weight: bold;">${item.product_id.name}</td>
                <td style="padding: 10px; text-align: right;">SL: ${item.quantity}</td>
              </tr>
            `,
              )
              .join('')}
          </table>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://hn-odyssey.com/cart" style="padding: 12px 25px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">THANH TOÁN NGAY</a>
          </div>
        </div>
      `;

      await this.emailService.sendRaw(
        user.email,
        '[H&N Odyssey] Giỏ hàng của bạn đang chờ!',
        htmlContent,
      );
      this.logger.log(
        `[RETARGETING] Sent Abandoned Cart email to ${user.email}`,
      );
    }
  }

  // HOÀN THIỆN US1 - AC7: LẮNG NGHE SỰ KIỆN GÁN MÃ VÀ GỬI THÔNG BÁO (BADGE/PUSH)

  @OnEvent('coupon.assigned.to.user')
  async handleCouponAssignedEvent(payload: ICouponAssignedEvent) {
    try {
      // 1. Gửi Push Notification / Cập nhật Badge đỏ trên Icon (Bắt buộc theo AC7)
      await this.notificationsService.createAndSend({
        recipient_role: 'CUSTOMER',
        recipient_id: payload.user_id.toString(),
        title: 'Bạn có 1 mã giảm giá mới chưa dùng! 🎁',
        message: `H&N Odyssey gửi tặng bạn mã ${payload.coupon_code} nhân dịp ${payload.reason}. Lưu mã và sử dụng ngay nhé!`,
        type: NotificationType.PROMOTION,
        priority: NotificationPriority.HIGH,
        metadata: {
          target_url: '/wallet/vouchers',
          coupon_code: payload.coupon_code,
        },
      });

      // 2. Gửi Email thông báo (Bổ sung để tăng trải nghiệm đa kênh)
      const discountDisplay =
        payload.discount_type === DiscountType.PERCENTAGE
          ? `${payload.discount_value}%`
          : `${payload.discount_value.toLocaleString('vi-VN')}đ`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #2c3e50;">Chào ${payload.full_name},</h2>
          <p style="color: #555; line-height: 1.5;">H&N Odyssey vừa gửi tặng bạn một mã giảm giá đặc biệt nhân dịp <b>${payload.reason}</b>.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #000; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase;">MÃ GIẢM GIÁ CỦA BẠN</p>
            <h3 style="margin: 5px 0; color: #d32f2f; letter-spacing: 1px; font-size: 24px;">${payload.coupon_code}</h3>
            <p style="margin: 10px 0 0; color: #333;">Giá trị ưu đãi: <b>Giảm ${discountDisplay}</b></p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://hn-odyssey.com/wallet/vouchers" style="padding: 12px 25px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">KIỂM TRA VÍ VOUCHER</a>
          </div>
        </div>
      `;

      await this.emailService.sendRaw(
        payload.email,
        `[H&N Odyssey] Quà tặng dành riêng cho bạn: Mã ${payload.coupon_code}!`,
        htmlContent,
      );

      this.logger.log(
        `[PROMOTION] Đã gửi thông báo tặng mã ${payload.coupon_code} cho user ${payload.email} (Lý do: ${payload.reason})`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[PROMOTION] Lỗi khi gửi thông báo tặng mã: ${err.message}`,
        err.stack,
      );
    }
  }

  // AC5: WIN-BACK CAMPAIGN (Tái kích hoạt khách hàng cũ)
  // Chạy tự động vào 9h00 sáng mỗi ngày

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async executeWinBackCampaign() {
    this.logger.log('[WINBACK] Bắt đầu quét khách hàng Offline > 30 ngày...');

    const now = new Date();
    // Quét chính xác những người offline trong khoảng 30 đến 31 ngày trước
    // (Tránh spam gửi mail mỗi ngày cho cùng 1 người)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    // 1. Pipeline MongoDB tìm khách hàng thỏa điều kiện Offline
    const pipeline: PipelineStage[] = [
      {
        $match: {
          action: {
            $in: [BehaviorAction.VIEW_PAGE, BehaviorAction.VIEW_PRODUCT],
          },
          user_id: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$user_id',
          last_active: { $max: '$createdAt' },
        },
      },
      {
        $match: {
          last_active: { $lte: thirtyDaysAgo, $gte: thirtyOneDaysAgo },
        },
      },
    ];

    const inactiveUsers =
      await this.behaviorModel.aggregate<IInactiveUserAggregation>(pipeline);

    if (inactiveUsers.length === 0) {
      this.logger.log(
        '[WINBACK] Không có khách hàng nào đạt điều kiện hôm nay.',
      );
      return;
    }

    // Lấy thông tin email của tập khách hàng này
    const userIds = inactiveUsers.map((u) => u._id);
    const customers = await this.customerModel
      .find({ _id: { $in: userIds }, is_deleted: false })
      .lean();

    for (const customer of customers) {
      // 2. Tự động sinh Mã Voucher cá nhân hóa (Giảm 50k cho đơn từ 200k)
      const uniqueCode = `WB${customer._id.toString().substring(18).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;

      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 7); // Hạn dùng 7 ngày

      await this.couponModel.create({
        code: uniqueCode,
        description: 'Mã ưu đãi đặc biệt mừng bạn quay lại H&N Odyssey',
        discount_type: DiscountType.FIXED_AMOUNT,
        discount_value: 50000,
        min_order_value: 200000,
        start_date: now,
        end_date: expireDate,
        usage_limit: 1,
        user_usage_limit: 1,
        status: CouponStatus.ACTIVE,
        owner_id: customer._id, // Khóa cứng mã này chỉ cho User này
      });

      // 3. Gửi Email thông điệp "Chúng tôi nhớ bạn"
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 30px; text-align: center; background-color: #f9f9f9;">
          <div style="background-color: #fff; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <img src="https://hn-odyssey.com/logo.png" width="120" style="margin-bottom: 20px;" />
            <h2 style="color: #2c3e50;">Chào ${customer.fullName}, chúng tôi nhớ bạn!</h2>
            <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
              Đã một thời gian kể từ lần cuối bạn ghé thăm. Để chào mừng bạn quay trở lại, H&N Odyssey dành tặng riêng bạn một phần quà nhỏ.
            </p>
            
            <div style="background-color: #e8f5e9; border: 2px dashed #4caf50; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <p style="margin: 0; color: #2e7d32; font-size: 14px; text-transform: uppercase;">MÃ GIẢM GIÁ 50.000Đ</p>
              <h1 style="margin: 10px 0; color: #1b5e20; letter-spacing: 2px;">${uniqueCode}</h1>
              <p style="margin: 0; color: #666; font-size: 12px;">Áp dụng cho đơn từ 200.000đ. Hạn dùng 7 ngày.</p>
            </div>

            <a href="https://hn-odyssey.com?utm_source=winback_email" 
               style="display: inline-block; padding: 15px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase;">
              MUA SẮM NGAY
            </a>
          </div>
        </div>
      `;

      await this.emailService.sendRaw(
        customer.email,
        `Mừng ${customer.first_Name} quay lại, tặng bạn Voucher 50.000đ!`,
        htmlContent,
      );

      await this.notificationsService.createAndSend({
        recipient_role: 'CUSTOMER',
        recipient_id: customer._id.toString(),
        title: 'Bạn có 1 mã giảm giá mới chưa dùng!',
        message: `Mã ${uniqueCode} giảm 50.000đ dành riêng cho bạn đã được thêm vào Kho Voucher.`,
        type: NotificationType.LOYALTY, // Hoặc tạo type PROMOTION
        priority: NotificationPriority.HIGH,
        metadata: { target_url: '/wallet/vouchers', coupon_code: uniqueCode },
      });
    }

    this.logger.log(
      `[WINBACK] Đã gửi thành công chiến dịch tái kích hoạt cho ${customers.length} khách hàng.`,
    );
  }

  // BỔ SUNG US3 - AC3: CHECK ABANDONED CART CHO WEB POPUP

  async checkAbandonedCartPopup(userId: string): Promise<{
    has_abandoned_cart: boolean;
    item_count: number;
    message: string;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      return { has_abandoned_cart: false, item_count: 0, message: '' };
    }

    // Lấy giỏ hàng của user
    const cart = await this.cartModel
      .findOne({ user_id: new Types.ObjectId(userId) })
      .lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return { has_abandoned_cart: false, item_count: 0, message: '' };
    }

    // Kiểm tra xem giỏ hàng này đã bị "bỏ quên" chưa (không cập nhật trong 2 giờ qua)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cartUpdatedAt = new Date(cart.updatedAt || Date.now());

    if (cartUpdatedAt < twoHoursAgo) {
      return {
        has_abandoned_cart: true,
        item_count: cart.items.length,
        message: `Bạn còn để quên ${cart.items.length} món trong giỏ hàng. Hoàn tất ngay để nhận FreeShip!`,
      };
    }

    return { has_abandoned_cart: false, item_count: 0, message: '' };
  }

  // BỔ SUNG AC2: CÁ NHÂN HÓA NỘI DUNG EMAIL NEWSLETTER
  // Gửi định kỳ hàng tuần (Ví dụ: 10h sáng Thứ Bảy)

  @Cron('0 10 * * 6', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDynamicNewsletterEmail() {
    this.logger.log('[NEWSLETTER] Bắt đầu tạo Email Marketing cá nhân hóa...');

    // Lấy những user có đăng ký nhận bản tin (Giả định có cờ newsletter = true)
    const subscribers = await this.customerModel
      .find({ is_deleted: false }) // Có thể thêm filter: 'preferences.newsletter': true
      .select('email first_Name')
      .lean();

    for (const user of subscribers) {
      // Logic US.41: Truy xuất 3 sản phẩm khách hàng vừa xem gần nhất
      const recentViews = await this.behaviorModel
        .find({
          user_id: user._id,
          action: BehaviorAction.VIEW_PRODUCT,
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      let productBlocksHtml = '';

      if (recentViews.length > 0) {
        // Trích xuất Product IDs và loại bỏ trùng lặp
        const productIds = [
          ...new Set(recentViews.map((v) => v.metadata?.product_id)),
        ].filter(Boolean);

        // Khai báo kiểu rõ ràng cho dữ liệu trả về thay vì để Mongoose tự infer
        const products = (await this.productModel
          .find({ _id: { $in: productIds }, status: 'ACTIVE' })
          .select('name thumbnail price')
          .lean()) as unknown as Array<{
          name: string;
          thumbnail: string;
          price?: number;
        }>;

        if (products.length > 0) {
          productBlocksHtml = `
            <h3 style="color: #333; margin-top: 20px;">Dành riêng cho bạn từ những mục vừa xem:</h3>
            <div style="display: flex; gap: 15px;">
              ${products
                .map(
                  (p) => `
                <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; width: 30%;">
                  <img src="${p.thumbnail}" style="width: 100%; border-radius: 4px;" alt="${p.name}"/>
                  <p style="font-size: 14px; font-weight: bold; color: #222; margin: 10px 0 5px;">${p.name}</p>
                  <p style="color: #e53935; font-weight: bold; margin: 0;">${(p.price || 0).toLocaleString('vi-VN')} đ</p>
                </div>
              `,
                )
                .join('')}
            </div>
          `;
        }
      }

      // Nếu khách chưa xem gì (Cold start), lấy sản phẩm Trending (US.42 fallback)
      if (!productBlocksHtml) {
        // Bạn có thể query lấy top sản phẩm mới/bán chạy toàn sàn ở đây để thay thế
        productBlocksHtml = `<p>Hãy khám phá những bộ sưu tập mới nhất tuần này trên hệ thống của chúng tôi!</p>`;
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2>Chào ${user.first_Name},</h2>
          <p>Cuối tuần vui vẻ! Chúng tôi đã chuẩn bị sẵn một số ưu đãi và gợi ý thời trang hoàn hảo cho bạn.</p>
          ${productBlocksHtml}
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://hn-odyssey.com/" style="padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px;">Khám Phá Ngay</a>
          </div>
        </div>
      `;

      // AC2: Tiêu đề chứa tên khách hàng
      await this.emailService.sendRaw(
        user.email,
        `Chào ${user.first_Name}, có ưu đãi và gợi ý mới cho bạn tuần này!`,
        htmlContent,
      );
    }

    this.logger.log(
      `[NEWSLETTER] Đã gửi newsletter cá nhân hóa cho ${subscribers.length} người dùng.`,
    );
  }
}
