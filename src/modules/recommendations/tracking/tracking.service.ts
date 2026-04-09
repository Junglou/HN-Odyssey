import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserBehavior,
  BehaviorAction,
  DeviceType,
} from './schemas/user-behavior.schema';
import { TrackEventDto, MergeSessionDto } from './dto/track-event.dto';
import { Cart } from 'src/modules/sales/cart/schemas/cart.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectModel(UserBehavior.name)
    private readonly behaviorModel: Model<UserBehavior>,
    @InjectModel(Cart.name)
    private readonly cartModel: Model<Cart>,
    private readonly eventEmitter: EventEmitter2, // Dùng để bắn event sang Marketing/Notification
    private readonly configService: ConfigService,
  ) {}

  // US2 - AC5: Thu thập Email khách vãng lai
  async captureGuestEmail(session_id: string, email: string): Promise<void> {
    try {
      await this.behaviorModel.updateMany(
        { session_id: session_id },
        { $set: { 'metadata.guest_email': email } },
      );
      this.logger.log(`Captured guest email for session: ${session_id}`);
    } catch (error) {
      this.logger.error(
        `Failed to capture guest email: ${(error as Error).message}`,
      );
    }
  }

  // AC6: HIỆU NĂNG GHI LOG - Request xử lý Không đồng bộ (Fail-silently)
  logEvent(dto: TrackEventDto): void {
    try {
      // AC2: Logic xác định Bounce (Thoát trang quá nhanh)
      const is_bounce = (dto.dwell_time_seconds ?? 0) < 3;

      const behavior = new this.behaviorModel({
        ...dto,
        is_bounce,
        user_id: dto.user_id ? new Types.ObjectId(dto.user_id) : undefined,
      });

      // KHÔNG DÙNG AWAIT ở đây để không chặn request của Frontend
      behavior.save().catch((err) => {
        this.logger.error(
          `Failed to save tracking event: ${(err as Error).message}`,
        );
      });
    } catch (error) {
      // Fail-silently: Bắt lỗi nhưng không throw ra ngoài làm sập FE
      this.logger.error(
        `Tracking processing error: ${(error as Error).message}`,
      );
    }
  }

  // AC5: HỢP NHẤT DỮ LIỆU - Map toàn bộ lịch sử SessionID của Guest sang UserID
  async mergeGuestToMember(dto: MergeSessionDto): Promise<void> {
    try {
      await this.behaviorModel
        .updateMany(
          { session_id: dto.session_id, user_id: { $exists: false } },
          { $set: { user_id: new Types.ObjectId(dto.user_id) } },
        )
        .exec();
      this.logger.log(
        `Merged session ${dto.session_id} to user ${dto.user_id}`,
      );
    } catch (error) {
      this.logger.error(`Merge session failed: ${(error as Error).message}`);
    }
  }

  // US2 - AC3, AC4, AC5: XÁC ĐỊNH & CHỤP ẢNH BỎ QUÊN GIỎ HÀNG (Abandonment Detection)
  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectAbandonedCarts(): Promise<void> {
    this.logger.log('Bắt đầu quét các giỏ hàng bị bỏ quên...');

    // Inactivity X phút (Ví dụ: 30 phút -> 2 tiếng)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);

    // Tìm các giỏ hàng có sản phẩm nhưng không có cập nhật trong 30p qua
    const abandonedCarts = await this.cartModel
      .find({
        updatedAt: { $lte: thirtyMinutesAgo, $gte: twoHoursAgo },
        'items.0': { $exists: true },
      })
      .lean()
      .exec();

    for (const cart of abandonedCarts) {
      // Tìm hành vi cuối cùng của session này để lấy thông tin Device thật
      const lastBehavior = await this.behaviorModel
        .findOne({ session_id: cart.session_id })
        .sort({ createdAt: -1 })
        .exec();
      // AC4: Lưu Snapshot giỏ hàng vào bảng Behavior để đối chiếu Retargeting
      const snapshot = await this.behaviorModel.create({
        session_id: cart.session_id || 'SYSTEM_GENERATED',
        user_id: cart.user_id,
        action: BehaviorAction.EXIT_PAGE,
        path: '/cart',
        // Lấy device thật từ log gần nhất, nếu ko thấy mới để DESKTOP
        device: lastBehavior?.device || DeviceType.DESKTOP,
        metadata: {
          cart_snapshot: cart.items, // Lấy toàn bộ items hiện tại làm snapshot
          source: lastBehavior?.source || 'Direct', // Lấy luôn nguồn thật của khách
        },
      });

      // Bắn Event để Module Marketing/Notification gửi Email Retargeting (US.50)
      this.eventEmitter.emit('tracking.cart.abandoned', {
        cart_id: cart._id,
        user_id: cart.user_id,
        session_id: cart.session_id,
        snapshot_id: snapshot._id,
      });
    }
  }

  // US5 - AC4: Gửi sự kiện mua hàng sang GA4 với thông tin thật
  async sendPurchaseEventToGA4(order: Order, clientId: string) {
    // 3. Lấy giá trị từ file .env thông qua configService
    const measurementId = this.configService.get<string>('GA_MEASUREMENT_ID');
    const apiSecret = this.configService.get<string>('GA_API_SECRET');

    // Kiểm tra nếu chưa cấu hình thì thoát sớm để tránh lỗi
    if (!measurementId || !apiSecret) {
      this.logger.warn('GA4 Config is missing. Skipping event broadcast.');
      return;
    }

    try {
      await axios.post(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          client_id: clientId || order.session_id || 'anonymous',
          events: [
            {
              name: 'purchase',
              params: {
                currency: 'VND',
                value: order.total_amount,
                transaction_id: order.order_code,
                items: order.items.map((item) => ({
                  item_id: item.sku,
                  item_name: item.product_name,
                  price: item.price,
                  quantity: item.quantity,
                })),
              },
            },
          ],
        },
      );
      this.logger.log(`GA4 Purchase Event Sent: ${order.order_code}`);
    } catch (error: unknown) {
      // Cách xử lý chuẩn: Kiểm tra xem error có phải là instance của Error không
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to send GA4 event: ${errorMessage}`);
    }
  }
}
