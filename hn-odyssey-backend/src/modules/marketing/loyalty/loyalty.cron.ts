import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemberTier, MemberTierDocument } from './schemas/member-tier.schema';
import {
  Customer,
  CustomerDocument,
} from 'src/modules/users/customers/schemas/customer.schema';
import {
  Coupon,
  CouponDocument,
  CouponStatus,
  DiscountType,
} from '../promotions/schemas/coupon.schema';
import {
  LoyaltyHistory,
  LoyaltyHistoryDocument,
  PointTransactionType,
  PointStatus,
} from './schemas/loyalty-history.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface BirthdayCustomerResult {
  _id: Types.ObjectId;
  loyalty: {
    tier: string;
    point: number;
    total_spent: number;
  };
  dateOfBirth: Date;
}

@Injectable()
export class LoyaltyCronService {
  private readonly logger = new Logger(LoyaltyCronService.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(MemberTier.name) private tierModel: Model<MemberTierDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(LoyaltyHistory.name)
    private historyModel: Model<LoyaltyHistoryDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // AC3: Cấp Voucher tháng cho thành viên hoạt động (Chạy mùng 1 hàng tháng lúc 00:00)
  @Cron('0 0 1 * *')
  async distributeMonthlyVouchers() {
    this.logger.log('[CRON] Bắt đầu cấp Voucher định kỳ tháng');
    try {
      // Chỉ cấp cho Gold trở lên
      const activeCustomers = await this.customerModel
        .find({ 'loyalty.tier': { $in: ['GOLD', 'PLATINUM'] } })
        .select('_id loyalty.tier')
        .exec();

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Voucher tháng có hạn 30 ngày

      const couponsToInsert = activeCustomers.map((customer) => ({
        code: `MT-${customer.loyalty.tier}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        description: `Voucher ưu đãi tháng dành cho hạng ${customer.loyalty.tier}`,
        discount_type: DiscountType.PERCENTAGE,
        discount_value: customer.loyalty.tier === 'PLATINUM' ? 15 : 10,
        start_date: new Date(),
        end_date: endDate,
        usage_limit: 1,
        user_usage_limit: 1,
        status: CouponStatus.ACTIVE,
      }));

      if (couponsToInsert.length > 0) {
        await this.couponModel.insertMany(couponsToInsert);
      }
      this.logger.log(
        `[CRON] Đã cấp thành công ${couponsToInsert.length} voucher tháng`,
      );
    } catch (error) {
      this.logger.error('[CRON FAIL] Lỗi cấp voucher tháng', error);
    }
  }

  // AC9: Xét duyệt giáng hạng thường niên (Chạy ngày 1 tháng 1 hàng năm)
  @Cron(CronExpression.EVERY_YEAR)
  async processAnnualDowngrades() {
    this.logger.log('[CRON] Bắt đầu xét duyệt giáng hạng thường niên');
    try {
      const tiers = await this.tierModel
        .find()
        .sort({ min_spent: -1 })
        .lean()
        .exec();

      const lowestTier = await this.tierModel
        .findOne()
        .sort({ min_spent: 1 })
        .lean()
        .exec();
      const defaultTierCode = lowestTier ? lowestTier.code : 'SILVER'; // Fallback an toàn

      for (const tier of tiers) {
        await this.customerModel.updateMany(
          {
            'loyalty.tier': tier.code,
            'loyalty.total_spent': { $lt: tier.min_spent },
          },
          { $set: { 'loyalty.tier': defaultTierCode } }, // Sử dụng biến động thay vì Hardcode
        );
      }

      await this.customerModel.updateMany(
        {},
        { $set: { 'loyalty.total_spent': 0 } },
      );
      this.logger.log('[CRON] Hoàn tất xét duyệt giáng hạng và reset chu kỳ');
    } catch (error) {
      this.logger.error('[CRON FAIL] Lỗi giáng hạng', error);
    }
  }

  // AC6 (US.36): Chạy 08:00 sáng mỗi ngày, quét và tặng quà sinh nhật trước 3 ngày
  @Cron('0 8 * * *')
  async processBirthdayRewards() {
    this.logger.log('[CRON] Bắt đầu quét và tặng quà sinh nhật chủ động');
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3); // Cấu hình gửi trước 3 ngày

      const targetMonth = targetDate.getMonth() + 1; // MongoDB month (1-12)
      const targetDay = targetDate.getDate();

      // [FIX]: Gắn Generics <BirthdayCustomerResult> để Type-Safe đầu ra của Aggregation
      const upcomingBirthdays =
        await this.customerModel.aggregate<BirthdayCustomerResult>([
          {
            $match: {
              dateOfBirth: { $exists: true, $ne: null },
            },
          },
          {
            $addFields: {
              birthMonth: { $month: '$dateOfBirth' },
              birthDay: { $dayOfMonth: '$dateOfBirth' },
            },
          },
          {
            $match: {
              birthMonth: targetMonth,
              birthDay: targetDay,
            },
          },
        ]);

      for (const customer of upcomingBirthdays) {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);

        // [FIX]: Dùng String() bọc lại để đảm bảo TS hiểu rõ đầu vào cho Types.ObjectId
        const hasReceived = await this.historyModel.exists({
          customer_id: new Types.ObjectId(String(customer._id)),
          type: PointTransactionType.BIRTHDAY,
          createdAt: { $gte: startOfYear },
        });

        if (hasReceived) continue;

        let voucherValue = 0;
        let hasPhysicalGift = false;

        // Bây giờ customer.loyalty.tier đã có Type đầy đủ, không còn lỗi ESLint nữa
        if (customer.loyalty.tier === 'SILVER') {
          voucherValue = 2; // Tương đương ~50k VNĐ cũ
        } else if (
          customer.loyalty.tier === 'GOLD' ||
          customer.loyalty.tier === 'PLATINUM' ||
          customer.loyalty.tier === 'DIAMOND'
        ) {
          voucherValue = 10; // Tương đương ~250k VNĐ cũ
          hasPhysicalGift = true;
        }

        if (voucherValue > 0) {
          const code = `HPBD-${customer.loyalty.tier}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);

          await this.couponModel.create({
            code,
            description: `Quà tặng sinh nhật dành cho hạng ${customer.loyalty.tier}`,
            discount_type: DiscountType.FIXED_AMOUNT,
            discount_value: voucherValue,
            start_date: new Date(),
            end_date: endDate,
            usage_limit: 1,
            user_usage_limit: 1,
            customer_id: customer._id,
            status: CouponStatus.ACTIVE,
          });

          const descriptionDetail = hasPhysicalGift
            ? `Nhận Voucher ${voucherValue}đ và 1 phần quà hiện vật.`
            : `Nhận Voucher sinh nhật ${voucherValue}đ.`;

          await this.historyModel.create({
            customer_id: customer._id,
            type: PointTransactionType.BIRTHDAY,
            status: PointStatus.AVAILABLE,
            amount: 0,
            description: descriptionDetail,
          });

          this.eventEmitter.emit('loyalty.birthday_rewarded', {
            userId: String(customer._id),
            tier: customer.loyalty.tier,
            voucherValue: voucherValue,
            hasPhysicalGift: hasPhysicalGift,
          });
        }
      }
      this.logger.log(
        `[CRON] Hoàn tất tặng quà sinh nhật cho ${upcomingBirthdays.length} khách hàng.`,
      );
    } catch (error) {
      this.logger.error('[CRON FAIL] Lỗi cấp quà sinh nhật chủ động', error);
    }
  }
}
