import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, ClientSession } from 'mongoose';
import { MemberTier, MemberTierDocument } from './schemas/member-tier.schema';
import {
  LoyaltyHistory,
  LoyaltyHistoryDocument,
  PointStatus,
  PointTransactionType,
} from './schemas/loyalty-history.schema';
import {
  RedeemRewardDto,
  RewardCategory,
  QueryLoyaltyHistoryDto,
} from './dto/loyalty.dto';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Action, Resource } from 'src/common/enums/resource.enum';
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
import { randomBytes } from 'crypto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface AggregateSumResult {
  _id: null;
  totalExpiring?: number;
  totalPending?: number;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly POINT_EXPIRY_DAYS = 365;
  private readonly CONVERSION_RATE = 10000; // AC1: 10,000đ = 1 điểm

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(MemberTier.name) private tierModel: Model<MemberTierDocument>,
    @InjectModel(LoyaltyHistory.name)
    private historyModel: Model<LoyaltyHistoryDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel('Product') private productModel: Model<Product>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // LOGIC TRẢ VỀ THÔNG TIN (UI/UX - AC7, AC13, AC16)
  async getMyLoyaltyInfo(
    customerId: string,
  ): Promise<BaseResponse<Record<string, unknown>>> {
    await this.processLazyExpiration(customerId); // AC6: Lazy Expiry

    const customer = await this.customerModel
      .findById(customerId)
      .select('loyalty dateOfBirth')
      .lean()
      .exec();
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

    const currentTier = await this.tierModel
      .findOne({ code: customer.loyalty.tier })
      .lean()
      .exec();
    const nextTier = await this.tierModel
      .findOne({ min_spent: { $gt: currentTier?.min_spent || 0 } })
      .sort({ min_spent: 1 })
      .lean()
      .exec();

    const amountToNextTier = nextTier
      ? nextTier.min_spent - customer.loyalty.total_spent
      : 0;

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const expiringRecords =
      await this.historyModel.aggregate<AggregateSumResult>([
        {
          $match: {
            customer_id: new Types.ObjectId(customerId),
            status: PointStatus.AVAILABLE,
            remaining_amount: { $gt: 0 },
            expires_at: { $lte: nextMonth },
          },
        },
        { $group: { _id: null, totalExpiring: { $sum: '$remaining_amount' } } },
      ]);

    const pendingRecords =
      await this.historyModel.aggregate<AggregateSumResult>([
        {
          $match: {
            customer_id: new Types.ObjectId(customerId),
            status: PointStatus.PENDING,
          },
        },
        { $group: { _id: null, totalPending: { $sum: '$amount' } } },
      ]);

    return new BaseResponse(true, 'Thành công', {
      points: customer.loyalty.point,
      tier: customer.loyalty.tier,
      total_spent: customer.loyalty.total_spent,
      progress: {
        current_tier: currentTier?.name || 'SILVER',
        next_tier: nextTier?.name || null,
        amount_needed: amountToNextTier > 0 ? amountToNextTier : 0,
      },
      pending_points: pendingRecords[0]?.totalPending || 0,
      expiring_soon_points: expiringRecords[0]?.totalExpiring || 0,
    });
  }

  async estimateCheckoutPoints(
    customerId: string,
    orderAmount: number,
  ): Promise<BaseResponse<Record<string, number>>> {
    const customer = await this.customerModel
      .findById(customerId)
      .lean()
      .exec();
    const tierInfo = await this.tierModel
      .findOne({ code: customer?.loyalty.tier })
      .lean()
      .exec();
    const multiplier = tierInfo?.point_multiplier || 1;

    const earnedPoints =
      Math.floor(orderAmount / this.CONVERSION_RATE) * multiplier;
    return new BaseResponse(true, 'Ước tính thành công', { earnedPoints });
  }

  // LOGIC TÍCH ĐIỂM & HOÀN ĐIỂM (AC2, AC4, AC15)
  async addPendingPoints(
    customerId: string,
    orderId: string,
    orderTotal: number,
  ): Promise<void> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) return;

    const tierInfo = await this.tierModel
      .findOne({ code: customer.loyalty.tier })
      .exec();
    const multiplier = tierInfo?.point_multiplier || 1;
    const earnedPoints =
      Math.floor(orderTotal / this.CONVERSION_RATE) * multiplier;

    if (earnedPoints <= 0) return;

    await this.historyModel.create({
      customer_id: new Types.ObjectId(customerId),
      type: PointTransactionType.EARN,
      status: PointStatus.PENDING,
      amount: earnedPoints,
      base_order_amount: orderTotal,
      order_id: new Types.ObjectId(orderId),
      description: `Chờ duyệt điểm từ đơn hàng ${orderId}`,
    });
  }

  async confirmPendingPoints(
    customerId: string,
    orderId: string,
  ): Promise<void> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const pendingRecord = await this.historyModel
        .findOne({
          customer_id: new Types.ObjectId(customerId),
          order_id: new Types.ObjectId(orderId),
          status: PointStatus.PENDING,
        })
        .session(session);

      if (!pendingRecord) throw new Error('Không tìm thấy điểm chờ duyệt');

      // 1. Tính toán thực tế TRƯỚC khi sử dụng
      const customer = await this.customerModel
        .findById(customerId)
        .session(session);
      if (!customer) throw new Error('Khách hàng không tồn tại');

      const actualSpent = pendingRecord.base_order_amount || 0;

      // Cập nhật điểm và tổng chi tiêu của khách hàng
      await this.customerModel.updateOne(
        { _id: customerId },
        {
          $inc: {
            'loyalty.point': pendingRecord.amount,
            'loyalty.total_spent': actualSpent, // <--- Đã cập nhật đúng với actualSpent
          },
        },
        { session },
      );

      // 2. Cập nhật bản ghi lịch sử
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.POINT_EXPIRY_DAYS);

      pendingRecord.status = PointStatus.AVAILABLE;
      pendingRecord.remaining_amount = pendingRecord.amount;
      pendingRecord.expires_at = expiresAt;
      await pendingRecord.save({ session });

      // Đã xóa Bước 3 thừa ở đây

      // 4. Lấy dữ liệu mới nhất để kiểm tra nâng hạng
      const updatedCustomer = await this.customerModel
        .findById(customerId)
        .session(session);
      if (updatedCustomer) {
        await this.checkAndUpgradeTier(updatedCustomer, session);
        await updatedCustomer.save({ session });
      }

      await session.commitTransaction();

      // BỔ SUNG: Bắn sự kiện cộng điểm
      this.eventEmitter.emit('loyalty.points_earned', {
        userId: customerId,
        orderId: orderId,
        pointsAmount: pendingRecord.amount,
      });
    } catch (error: unknown) {
      await session.abortTransaction();
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi duyệt điểm đơn ${orderId}: ${msg}`);
    } finally {
      await session.endSession();
    }
  }

  async revokePointsForRefund(
    customerId: string,
    orderId: string,
    refundValue: number,
  ): Promise<void> {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) return;

    const multiplier = await this.getMultiplier(customer.loyalty.tier);
    const pointsToRevoke =
      Math.floor(refundValue / this.CONVERSION_RATE) * multiplier;

    customer.loyalty.point -= pointsToRevoke;
    customer.loyalty.total_spent -= refundValue;
    await customer.save();

    await this.historyModel.create({
      customer_id: new Types.ObjectId(customerId),
      type: PointTransactionType.REFUND,
      status: PointStatus.AVAILABLE,
      amount: -pointsToRevoke,
      order_id: new Types.ObjectId(orderId),
      description: `Thu hồi điểm do trả hàng đơn ${orderId}`,
    });
  }

  // LOGIC ĐỔI THƯỞNG (AC3, AC8)
  async redeemPoints(
    customerId: string,
    dto: RedeemRewardDto,
  ): Promise<BaseResponse<Record<string, unknown>>> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      await this.processLazyExpiration(customerId);

      const customer = await this.customerModel
        .findById(customerId)
        .session(session);
      if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

      if (customer.loyalty.point < dto.points_to_redeem) {
        throw new BadRequestException('Số điểm khả dụng không đủ');
      }

      if (dto.reward_category === RewardCategory.PHYSICAL_GIFT) {
        if (!dto.gift_id)
          throw new BadRequestException('Vui lòng chọn quà tặng');

        // Giả sử bạn đã inject ProductModel vào Service
        const giftItem = await this.productModel.findOneAndUpdate(
          { _id: dto.gift_id, stock: { $gte: 1 } }, // Chỉ tìm sản phẩm có tồn kho >= 1
          { $inc: { stock: -1 } }, // Trừ 1 Atomic
          { session, new: true },
        );

        if (!giftItem) {
          throw new BadRequestException(
            'Quà tặng không tồn tại hoặc đã hết hàng',
          );
        }
      }

      let pointsToDeduct = dto.points_to_redeem;
      const availableRecords = await this.historyModel
        .find({
          customer_id: new Types.ObjectId(customerId),
          status: PointStatus.AVAILABLE,
          remaining_amount: { $gt: 0 },
        })
        .sort({ createdAt: 1 })
        .session(session);

      for (const record of availableRecords) {
        if (pointsToDeduct <= 0) break;
        const remaining = record.remaining_amount ?? 0;
        if (remaining >= pointsToDeduct) {
          record.remaining_amount = remaining - pointsToDeduct;
          pointsToDeduct = 0;
        } else {
          pointsToDeduct -= remaining;
          record.remaining_amount = 0;
        }
        await record.save({ session });
      }

      await this.customerModel.updateOne(
        { _id: customerId },
        { $inc: { 'loyalty.point': -dto.points_to_redeem } },
        { session },
      );

      let resultData: Record<string, unknown> = {};

      if (dto.reward_category === RewardCategory.VOUCHER) {
        const value =
          dto.discount_type === DiscountType.PERCENTAGE
            ? 10
            : dto.points_to_redeem * 100;
        const coupon = await this.generateRewardCoupon(
          customerId,
          dto.discount_type || DiscountType.FIXED_AMOUNT,
          value,
          'Voucher đổi từ điểm',
          session,
        );
        resultData = { coupon_code: coupon.code };
      } else {
        resultData = {
          message: 'Đã ghi nhận yêu cầu đổi quà hiện vật.',
        };
      }

      await this.historyModel.create(
        [
          {
            customer_id: new Types.ObjectId(customerId),
            type: PointTransactionType.REDEEM,
            status: PointStatus.AVAILABLE,
            amount: -dto.points_to_redeem,
            description: `Đổi ${dto.points_to_redeem} điểm lấy ${dto.reward_category}`,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      try {
        await this.auditLogsService.log({
          action: Action.UPDATE,
          collection_name: Resource.LOYALTY,
          actor_id: customerId,
          department: Department.MARKETING,
          target_id: String(customer._id),
          detail: { redeemed: dto.points_to_redeem, type: dto.reward_category },
        });
      } catch (logError) {
        this.logger.error(
          `Audit Log Fail: ${logError instanceof Error ? logError.message : 'Unknown'}`,
        );
      }

      // BỔ SUNG: Bắn sự kiện đổi quà
      this.eventEmitter.emit('loyalty.reward_redeemed', {
        userId: customerId,
        pointsUsed: dto.points_to_redeem,
        rewardType: dto.reward_category,
      });

      return new BaseResponse(true, 'Đổi điểm thành công', resultData);
    } catch (error: unknown) {
      await session.abortTransaction();
      if (error instanceof BadRequestException) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Lỗi đổi điểm: ${msg}`);
    } finally {
      await session.endSession();
    }
  }

  // HELPERS
  private async getMultiplier(tierCode: string): Promise<number> {
    const tier = await this.tierModel.findOne({ code: tierCode }).lean().exec();
    return tier?.point_multiplier || 1;
  }

  private async checkAndUpgradeTier(
    customer: CustomerDocument,
    session: ClientSession,
  ): Promise<void> {
    const eligibleTiers = await this.tierModel
      .find({ min_spent: { $lte: customer.loyalty.total_spent } })
      .sort({ min_spent: -1 })
      .session(session);

    if (eligibleTiers.length === 0) return;

    const highestTier = eligibleTiers[0];
    if (customer.loyalty.tier !== highestTier.code) {
      if (highestTier.upgrade_reward?.is_active) {
        // [FIX 390]: Dùng String(customer._id) để fix lỗi 'id' does not exist và unsafe argument
        await this.generateRewardCoupon(
          String(customer._id),
          highestTier.upgrade_reward.discount_type,
          highestTier.upgrade_reward.discount_value,
          `Thăng hạng ${highestTier.name}`,
          session,
        );

        // BỔ SUNG: Bắn sự kiện thăng hạng
        this.eventEmitter.emit('loyalty.tier_upgraded', {
          userId: String(customer._id),
          tierName: highestTier.name,
          rewardValue: highestTier.upgrade_reward.discount_value,
          discountType: highestTier.upgrade_reward.discount_type,
        });
      }
      customer.loyalty.tier = highestTier.code;
    }
  }

  private async processLazyExpiration(customerId: string): Promise<void> {
    const now = new Date();
    const expiredRecords = await this.historyModel
      .find({
        customer_id: new Types.ObjectId(customerId),
        status: PointStatus.AVAILABLE,
        remaining_amount: { $gt: 0 },
        expires_at: { $lt: now },
      })
      .exec();

    if (expiredRecords.length === 0) return;

    let totalExpired = 0;
    for (const record of expiredRecords) {
      totalExpired += record.remaining_amount ?? 0;
      record.remaining_amount = 0;
      await record.save();
    }

    await this.customerModel.findByIdAndUpdate(customerId, {
      $inc: { 'loyalty.point': -totalExpired },
    });
    await this.historyModel.create({
      customer_id: new Types.ObjectId(customerId),
      type: PointTransactionType.EXPIRE,
      status: PointStatus.AVAILABLE,
      amount: -totalExpired,
      description: `Điểm hết hạn hệ thống tự động trừ (${totalExpired})`,
    });
  }

  private async generateRewardCoupon(
    customerId: string,
    type: DiscountType,
    value: number,
    desc: string,
    session?: ClientSession,
  ): Promise<Coupon> {
    // Tạo mã an toàn hơn: RW-XXXX-XXXX
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const code = `RW-${suffix}`;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const coupons = await this.couponModel.create(
      [
        {
          code,
          description: desc,
          discount_type: type,
          discount_value: value,
          start_date: new Date(),
          end_date: endDate,
          usage_limit: 1,
          user_usage_limit: 1,
          customer_id: new Types.ObjectId(customerId), // Nên gắn thêm ID khách để chỉ họ dùng được
          status: CouponStatus.ACTIVE,
        },
      ],
      { session },
    );
    return coupons[0];
  }

  async getHistory(
    customerId: string,
    query: QueryLoyaltyHistoryDto,
  ): Promise<BaseResponse<LoyaltyHistory[]>> {
    const skip = (Number(query.page) - 1) * Number(query.limit);
    const [data, total] = await Promise.all([
      this.historyModel
        .find({ customer_id: new Types.ObjectId(customerId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(query.limit))
        .lean()
        .exec(),
      this.historyModel.countDocuments({
        customer_id: new Types.ObjectId(customerId),
      }),
    ]);
    return new BaseResponse(true, 'Thành công', data as LoyaltyHistory[], {
      currentPage: Number(query.page),
      itemsPerPage: Number(query.limit),
      totalItems: total,
      totalPages: Math.ceil(total / Number(query.limit)),
      itemCount: data.length,
    });
  }

  async cancelPendingPoints(
    customerId: string,
    orderId: string,
  ): Promise<void> {
    await this.historyModel.updateMany(
      {
        customer_id: new Types.ObjectId(customerId),
        order_id: new Types.ObjectId(orderId),
        status: PointStatus.PENDING,
      },
      {
        $set: {
          status: PointStatus.CANCELED,
          description: 'Đơn hàng bị hủy, điểm thưởng bị hủy',
        },
      },
    );
  }
}
