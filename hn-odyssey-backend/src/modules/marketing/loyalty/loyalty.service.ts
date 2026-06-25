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

// Khai báo kiểu dữ liệu cho User lấy từ collection raw để tránh lỗi unsafe-assignment và unsafe-member-access
interface UserLoyaltyData {
  tier?: string;
  total_spent?: number;
  point?: number;
}

interface UserDocument {
  _id: Types.ObjectId;
  loyalty?: UserLoyaltyData;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly POINT_EXPIRY_DAYS = 365;
  private readonly CONVERSION_RATE = 1; // Hệ USD: 1$ = 1 điểm

  constructor(
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
    await this.processLazyExpiration(customerId);

    // FIX: Trỏ thẳng vào collection users
    const customer = (await this.connection
      .collection('users')
      .findOne({ _id: new Types.ObjectId(customerId) })) as UserDocument | null;

    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

    const tierCode = customer.loyalty?.tier || 'BRONZE';
    const totalSpent = customer.loyalty?.total_spent || 0;
    const currentPoints = customer.loyalty?.point || 0;

    const currentTier = await this.tierModel
      .findOne({ code: tierCode })
      .lean()
      .exec();
    const nextTier = await this.tierModel
      .findOne({ min_spent: { $gt: currentTier?.min_spent || 0 } })
      .sort({ min_spent: 1 })
      .lean()
      .exec();

    const amountToNextTier = nextTier ? nextTier.min_spent - totalSpent : 0;

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
      points: currentPoints,
      tier: tierCode,
      total_spent: totalSpent,
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
    const customer = (await this.connection
      .collection('users')
      .findOne({ _id: new Types.ObjectId(customerId) })) as UserDocument | null;

    const tierCode = customer?.loyalty?.tier || 'SILVER';
    const tierInfo = await this.tierModel
      .findOne({ code: tierCode })
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
    try {
      this.logger.log(
        `[Loyalty] Bắt đầu tích điểm PENDING. User: ${customerId}, Đơn: ${orderId}, Giá trị: ${orderTotal}`,
      );

      const customer = (await this.connection.collection('users').findOne({
        _id: new Types.ObjectId(customerId),
      })) as UserDocument | null;

      if (!customer) {
        this.logger.error(
          `[Loyalty] Không tìm thấy user ${customerId} trong collection 'users'. Hủy tích điểm!`,
        );
        return;
      }

      const tierCode = customer?.loyalty?.tier || 'BRONZE';
      const tierInfo = await this.tierModel.findOne({ code: tierCode }).exec();
      const multiplier = tierInfo?.point_multiplier || 1;

      const earnedPoints =
        Math.floor(orderTotal / this.CONVERSION_RATE) * multiplier;

      if (earnedPoints <= 0) {
        this.logger.warn(`[Loyalty] Số điểm nhận được là 0. Bỏ qua ghi nhận.`);
        return;
      }

      await this.historyModel.create({
        customer_id: new Types.ObjectId(customerId),
        type: PointTransactionType.EARN,
        status: PointStatus.PENDING,
        amount: earnedPoints,
        base_order_amount: orderTotal,
        order_id: new Types.ObjectId(orderId),
        description: `Chờ duyệt điểm từ đơn hàng ${orderId}`,
      });

      this.logger.log(
        `[Loyalty] THÀNH CÔNG! Đã tạo record PENDING ${earnedPoints} điểm cho User ${customerId}.`,
      );
    } catch (error) {
      this.logger.error(
        `[Loyalty] Lỗi addPendingPoints: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async confirmPendingPoints(
    customerId: string,
    orderId: string,
  ): Promise<void> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      this.logger.log(`[Loyalty] Tiến hành DUYỆT ĐIỂM cho đơn hàng ${orderId}`);

      const pendingRecord = await this.historyModel
        .findOne({
          customer_id: new Types.ObjectId(customerId),
          order_id: new Types.ObjectId(orderId),
          status: PointStatus.PENDING,
        })
        .session(session);

      if (!pendingRecord) {
        this.logger.warn(
          `[Loyalty] Bỏ qua duyệt điểm: Không có điểm PENDING cho đơn ${orderId} (Đơn cũ hoặc không đủ điều kiện).`,
        );
        await session.abortTransaction(); // Đóng giao dịch sớm
        return;
      }

      const customer = (await this.connection
        .collection('users')
        .findOne(
          { _id: new Types.ObjectId(customerId) },
          { session },
        )) as UserDocument | null;

      if (!customer) throw new Error('Khách hàng không tồn tại');

      const actualSpent = pendingRecord.base_order_amount || 0;

      // Cập nhật điểm và tổng chi tiêu của khách hàng
      await this.connection.collection('users').updateOne(
        { _id: new Types.ObjectId(customerId) },
        {
          $inc: {
            'loyalty.point': pendingRecord.amount,
            'loyalty.total_spent': actualSpent,
          },
        },
        { session },
      );

      // Cập nhật bản ghi lịch sử sang AVAILABLE
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.POINT_EXPIRY_DAYS);

      pendingRecord.status = PointStatus.AVAILABLE;
      pendingRecord.remaining_amount = pendingRecord.amount;
      pendingRecord.expires_at = expiresAt;
      await pendingRecord.save({ session });

      // Lấy dữ liệu mới nhất để kiểm tra nâng hạng
      const updatedCustomer = (await this.connection
        .collection('users')
        .findOne(
          { _id: new Types.ObjectId(customerId) },
          { session },
        )) as UserDocument | null;

      if (updatedCustomer) {
        await this.checkAndUpgradeTier(updatedCustomer, customerId, session);
      }

      await session.commitTransaction();

      this.logger.log(
        `[Loyalty] Đã duyệt thành công ${pendingRecord.amount} điểm!`,
      );
      this.eventEmitter.emit('loyalty.points_earned', {
        userId: customerId,
        orderId: orderId,
        pointsAmount: pendingRecord.amount,
      });
    } catch (error: unknown) {
      await session.abortTransaction();
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Loyalty] Lỗi duyệt điểm đơn ${orderId}: ${msg}`);
    } finally {
      await session.endSession();
    }
  }

  // thu hồi điểm khi trả hàng với chốt chặn an toàn không vượt quá điểm khả dụng của khách
  async revokePointsForRefund(
    customerId: string,
    orderId: string,
    refundValue: number,
  ): Promise<void> {
    try {
      const customer = (await this.connection.collection('users').findOne({
        _id: new Types.ObjectId(customerId),
      })) as UserDocument | null;

      if (!customer) return;

      const tierCode = customer?.loyalty?.tier || 'BRONZE';
      const multiplier = await this.getMultiplier(tierCode);
      const calculatedRevoke =
        Math.floor(refundValue / this.CONVERSION_RATE) * multiplier;

      const currentPoints = customer.loyalty?.point || 0;
      const actualRevoke = Math.min(calculatedRevoke, currentPoints);

      if (actualRevoke > 0) {
        await this.connection.collection('users').updateOne(
          { _id: new Types.ObjectId(customerId) },
          {
            $inc: {
              'loyalty.point': -actualRevoke,
              'loyalty.total_spent': -refundValue,
            },
          },
        );

        await this.historyModel.create({
          customer_id: new Types.ObjectId(customerId),
          type: PointTransactionType.REFUND,
          status: PointStatus.AVAILABLE,
          amount: -actualRevoke,
          order_id: new Types.ObjectId(orderId),
          description: 'Thu hồi điểm từ đơn trả hàng theo mức thực tế khả dụng',
        });
      } else {
        // khách hàng đã hết điểm để thu hồi, tiến hành trừ tổng chi tiêu để giáng hạng ở kỳ sau
        await this.connection
          .collection('users')
          .updateOne(
            { _id: new Types.ObjectId(customerId) },
            { $inc: { 'loyalty.total_spent': -refundValue } },
          );
      }
    } catch (error) {
      this.logger.error(`[Loyalty] Lỗi thu hồi điểm: ${error}`);
    }
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

      const customer = (await this.connection
        .collection('users')
        .findOne(
          { _id: new Types.ObjectId(customerId) },
          { session },
        )) as UserDocument | null;

      if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
      const currentPoints = customer.loyalty?.point || 0;

      if (currentPoints < dto.points_to_redeem) {
        throw new BadRequestException('Số điểm khả dụng không đủ');
      }

      if (dto.reward_category === RewardCategory.PHYSICAL_GIFT) {
        if (!dto.gift_id)
          throw new BadRequestException('Vui lòng chọn quà tặng');

        const giftItem = await this.productModel.findOneAndUpdate(
          { _id: dto.gift_id, stock: { $gte: 1 } },
          { $inc: { stock: -1 } },
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

      await this.connection
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(customerId) },
          { $inc: { 'loyalty.point': -dto.points_to_redeem } },
          { session },
        );

      let resultData: Record<string, unknown> = {};

      if (dto.reward_category === RewardCategory.VOUCHER) {
        // chuyển đổi linh hoạt tỷ lệ điểm ra phần trăm, giới hạn biên độ để đảm bảo vận hành tài chính an toàn
        const value =
          dto.discount_type === DiscountType.PERCENTAGE
            ? Math.min(Math.max(1, Math.floor(dto.points_to_redeem / 100)), 50)
            : dto.points_to_redeem / 100;
        const coupon = await this.generateRewardCoupon(
          customerId,
          dto.discount_type || DiscountType.FIXED_AMOUNT,
          value,
          'Voucher đổi từ điểm',
          session,
        );
        resultData = { coupon_code: coupon.code };
      } else {
        resultData = { message: 'Đã ghi nhận yêu cầu đổi quà hiện vật.' };
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
          target_id: customerId,
          detail: { redeemed: dto.points_to_redeem, type: dto.reward_category },
        });
      } catch (logError) {
        this.logger.error(
          `Audit Log Fail: ${logError instanceof Error ? logError.message : 'Unknown'}`,
        );
      }

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
    customerInfo: UserDocument,
    customerId: string,
    session: ClientSession,
  ): Promise<void> {
    const totalSpent = customerInfo.loyalty?.total_spent || 0;
    const currentTierCode = customerInfo.loyalty?.tier || 'SILVER';

    const eligibleTiers = await this.tierModel
      .find({ min_spent: { $lte: totalSpent } })
      .sort({ min_spent: -1 })
      .session(session);

    if (eligibleTiers.length === 0) return;

    const highestTier = eligibleTiers[0];
    if (currentTierCode !== highestTier.code) {
      await this.connection
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(customerId) },
          { $set: { 'loyalty.tier': highestTier.code } },
          { session },
        );

      if (highestTier.upgrade_reward?.is_active) {
        await this.generateRewardCoupon(
          customerId,
          highestTier.upgrade_reward.discount_type,
          highestTier.upgrade_reward.discount_value,
          `Thăng hạng ${highestTier.name}`,
          session,
        );

        this.eventEmitter.emit('loyalty.tier_upgraded', {
          userId: customerId,
          tierName: highestTier.name,
          rewardValue: highestTier.upgrade_reward.discount_value,
          discountType: highestTier.upgrade_reward.discount_type,
        });
      }
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

    await this.connection
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(customerId) },
        { $inc: { 'loyalty.point': -totalExpired } },
      );

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
          customer_id: new Types.ObjectId(customerId),
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

  // cấn trừ điểm vào từng bản ghi lịch sử để tránh bị hệ thống quét hết hạn lặp lại đối với điểm đã dùng
  async deductPointsForOrder(
    customerId: string,
    pointsToDeduct: number,
    orderId: string,
    session: ClientSession,
  ): Promise<void> {
    const availableRecords = await this.historyModel
      .find({
        customer_id: new Types.ObjectId(customerId),
        status: PointStatus.AVAILABLE,
        remaining_amount: { $gt: 0 },
      })
      .sort({ createdAt: 1 })
      .session(session);

    let remainingToDeduct = pointsToDeduct;

    for (const record of availableRecords) {
      if (remainingToDeduct <= 0) break;
      const available = record.remaining_amount ?? 0;

      if (available >= remainingToDeduct) {
        record.remaining_amount = available - remainingToDeduct;
        remainingToDeduct = 0;
      } else {
        remainingToDeduct -= available;
        record.remaining_amount = 0;
      }
      await record.save({ session });
    }

    await this.connection
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(customerId) },
        { $inc: { 'loyalty.point': -pointsToDeduct } },
        { session },
      );

    await this.historyModel.create(
      [
        {
          customer_id: new Types.ObjectId(customerId),
          type: PointTransactionType.REDEEM,
          status: PointStatus.AVAILABLE,
          amount: -pointsToDeduct,
          order_id: new Types.ObjectId(orderId),
          description: 'Sử dụng điểm để thanh toán đơn hàng',
        },
      ],
      { session },
    );
  }
}
