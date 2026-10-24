import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose';
import { Subject } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  NotificationLog,
  NotificationPriority,
  NotificationScope,
  NotificationStatus,
  NotificationType,
  PRIORITY_RANK,
  NOTIFICATION_VISIBLE_DAYS,
} from './schemas/notification-log.schema';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationAudienceService } from './notification-audience.service';
import {
  NOTIFICATION_POLICIES,
  NotificationEvent,
} from './notification-policy.constant';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { AuditLogsService } from '../system/audit-logs/audit-logs.service';
import { EmailService } from './channels/email.service';
import { ConfigService } from '@nestjs/config';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';

export interface NotifyInput {
  title: string;
  message: string;
  /** Ghi đè mức độ mặc định của policy */
  priority?: NotificationPriority;
  /** Khóa gộp. Mặc định = mã sự kiện (nếu policy có cửa sổ gộp) */
  dedupeKey?: string;
  /** Ghi đè trang đích mặc định của policy */
  targetUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotifyResult {
  doc: NotificationLog | null;
  /** true = tạo thông báo mới; false = đã gộp vào thông báo đang mở / bỏ qua */
  isNew: boolean;
}

export interface NotificationPayload {
  _id: string;
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  event_code: string | null;
  occurrence_count: number;
  is_read: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  last_occurred_at: string;
}

// Cửa sổ gộp đơn mới: các đơn đến trong 10 giây thành 1 thông báo + 1 email
const ORDER_BATCH_WINDOW_MS = 10_000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly orderStream = new Subject<Order>();

  constructor(
    @InjectModel(NotificationLog.name)
    private readonly model: Model<NotificationLog>,
    private readonly gateway: NotificationsGateway,
    private readonly audience: NotificationAudienceService,
    private readonly auditLogsService: AuditLogsService,
    @InjectRedis() private readonly redis: Redis,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.initOrderBatching();
  }

  // 1. GỬI THÔNG BÁO

  /** Gửi thông báo Portal theo quyền, dựa trên NOTIFICATION_POLICIES */
  async notify(
    event: NotificationEvent,
    input: NotifyInput,
  ): Promise<NotifyResult> {
    const policy = NOTIFICATION_POLICIES[event];
    const priority = input.priority ?? policy.priority;
    const canMerge = policy.dedupeWindowSec > 0;
    const dedupeKey = input.dedupeKey ?? (canMerge ? event : null);

    try {
      if (dedupeKey && canMerge) {
        const merged = await this.mergeIntoOpen(
          dedupeKey,
          policy.dedupeWindowSec,
          input.message,
          priority,
        );
        if (merged) return { doc: merged, isNew: false };

        // Khóa ngắn để 2 sự kiện đến cùng lúc không cùng tạo 2 thông báo
        const gotLock = await this.acquireLock(dedupeKey);
        if (!gotLock) {
          await this.sleep(300);
          const retry = await this.mergeIntoOpen(
            dedupeKey,
            policy.dedupeWindowSec,
            input.message,
            priority,
          );
          return { doc: retry, isNew: false };
        }
      }

      const doc = await this.model.create({
        scope: NotificationScope.PORTAL,
        event_code: event,
        recipient_id: null,
        target_resource: policy.resource,
        required_action: policy.action,
        min_level: policy.minLevel,
        title: input.title,
        message: input.message,
        type: policy.type,
        priority,
        metadata: {
          ...(input.metadata ?? {}),
          target_url: input.targetUrl ?? policy.targetUrl,
        },
        dedupe_key: dedupeKey,
        last_occurred_at: new Date(),
      });

      await this.writeAudit(doc);
      await this.emitToRecipients(doc, 'new_notification');
      return { doc, isNew: true };
    } catch (error) {
      this.logger.error(
        `notify(${event}) thất bại`,
        error instanceof Error ? error.stack : String(error),
      );
      return { doc: null, isNew: false };
    }
  }

  /** Gửi thông báo cho đúng 1 người (khách hàng, hoặc 1 nhân sự cụ thể) */
  async notifyUser(
    userId: string | Types.ObjectId,
    input: NotifyInput & { type: NotificationType; scope?: NotificationScope },
  ): Promise<NotifyResult> {
    try {
      const recipientId = new Types.ObjectId(String(userId));
      const doc = await this.model.create({
        scope: input.scope ?? NotificationScope.CUSTOMER,
        recipient_id: recipientId,
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority ?? NotificationPriority.MEDIUM,
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.targetUrl ? { target_url: input.targetUrl } : {}),
        },
        last_occurred_at: new Date(),
      });

      this.gateway.sendToUsers(
        [String(recipientId)],
        'new_notification',
        this.toPayload(doc),
      );
      return { doc, isNew: true };
    } catch (error) {
      this.logger.error(
        `notifyUser(${String(userId)}) thất bại`,
        error instanceof Error ? error.stack : String(error),
      );
      return { doc: null, isNew: false };
    }
  }

  // 2. ĐƠN HÀNG MỚI (gộp các đơn đến trong 500ms thành 1 thông báo)

  private initOrderBatching() {
    this.orderStream
      .pipe(
        bufferTime(ORDER_BATCH_WINDOW_MS),
        filter((orders) => orders.length > 0),
      )
      .subscribe({
        next: (batch) => {
          void (async () => {
            try {
              if (batch.length === 1) {
                await this.broadcastOrder(batch[0]);
              } else {
                await this.broadcastOrderBatch(batch);
              }
            } catch (error) {
              this.logger.error('Lỗi khi xử lý batching đơn hàng:', error);
            }
          })();
        },
        error: (err) => this.logger.error('Order stream hỏng!', err),
      });
  }

  async notifyNewOrder(order: Order) {
    this.orderStream.next(order);
  }

  async pushToOrderStream(order: Order) {
    return this.notifyNewOrder(order);
  }

  private async broadcastOrder(order: Order) {
    const customerName = order.shipping_info?.name || 'Khách vãng lai';
    await this.notify(NotificationEvent.ORDER_NEW, {
      title: 'Đơn hàng mới cần xác nhận',
      message: `Đơn #${order.order_code} của ${customerName} — ${this.formatMoney(order.total_amount)}`,
      targetUrl: `/portal/orders?orderCode=${encodeURIComponent(order.order_code)}`,
      metadata: {
        order_id: String(order._id),
        order_code: order.order_code,
      },
    });

    await this.sendSalesEmail(
      `[H&N Odyssey] Đơn hàng mới #${order.order_code}`,
      `Khách hàng: ${customerName} - Tổng: ${this.formatMoney(order.total_amount)}`,
    );
  }

  private async broadcastOrderBatch(batch: Order[]) {
    const totalValue = batch.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    await this.notify(NotificationEvent.ORDER_NEW, {
      title: `${batch.length} đơn hàng mới cần xác nhận`,
      message: `Tổng giá trị ${this.formatMoney(totalValue)}`,
      targetUrl: '/portal/orders?status=Pending',
      metadata: {
        is_batch: true,
        order_ids: batch.map((o) => String(o._id)),
        // Đơn còn chờ xử lý; danh sách rỗng thì thông báo gộp tự chuyển Resolved
        pending_order_ids: batch.map((o) => String(o._id)),
      },
    });

    const lines = batch
      .map(
        (o) =>
          `- #${o.order_code}: ${o.shipping_info?.name || 'Khách vãng lai'} - ${this.formatMoney(o.total_amount)}`,
      )
      .join('\n');
    await this.sendSalesEmail(
      `[H&N Odyssey] ${batch.length} đơn hàng mới cần xác nhận`,
      `Tổng giá trị: ${this.formatMoney(totalValue)}\n\n${lines}`,
    );
  }

  // Quy ước dự án: tiền hiển thị trên UI là USD
  private formatMoney(amount?: number): string {
    return `$${(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // 3. ĐÓNG CẢNH BÁO KHI SỰ CỐ ĐÃ ĐƯỢC XỬ LÝ

  /** Chuyển các thông báo OPEN khớp filter sang RESOLVED và báo cho người nhận */
  async resolveWhere(where: FilterQuery<NotificationLog>): Promise<number> {
    const docs = await this.model
      .find({ $and: [where, { status: NotificationStatus.OPEN }] })
      .exec();
    if (docs.length === 0) return 0;

    const now = new Date();
    await this.model
      .updateMany(
        { _id: { $in: docs.map((d) => d._id) } },
        { $set: { status: NotificationStatus.RESOLVED, resolved_at: now } },
      )
      .exec();

    for (const doc of docs) {
      doc.status = NotificationStatus.RESOLVED;
      doc.resolved_at = now;
      await this.emitToRecipients(doc, 'notification_resolved');
    }
    return docs.length;
  }

  async autoResolveStockAlert(sku: string) {
    const count = await this.resolveWhere({
      dedupe_key: {
        $in: [
          `${NotificationEvent.STOCK_LOW}:${sku}`,
          `${NotificationEvent.STOCK_OVER}:${sku}`,
        ],
      },
    });

    if (count > 0) {
      await this.auditLogsService.log({
        action: 'STOCK_ALERT_RESOLVED',
        collection_name: Resource.INVENTORY_STOCK,
        department: Department.WAREHOUSE,
        detail: {
          sku,
          message:
            'Tồn kho đã trở lại mức an toàn, hệ thống tự động đóng cảnh báo.',
        },
      });
    }
  }

  async autoResolveAlert(
    type: NotificationType,
    metadataKey: string,
    metadataValue: string,
  ) {
    const count = await this.resolveWhere({
      type,
      [`metadata.${metadataKey}`]: metadataValue,
    });

    if (count > 0) {
      await this.auditLogsService.log({
        action: 'SYSTEM_INCIDENT_RESOLVED',
        collection_name: Resource.SYSTEM_MONITORING,
        department: Department.MANAGEMENT,
        detail: {
          type,
          [metadataKey]: metadataValue,
          message: 'Sự cố đã được xử lý và đóng cảnh báo tự động.',
        },
      });
    }
  }

  /**
   * Đơn đã rời trạng thái chờ xác nhận → đóng thông báo "đơn mới" cho cả nhóm.
   * Thông báo gộp chỉ đóng khi TẤT CẢ đơn trong đó đã được xử lý.
   */
  async resolveOrderHandled(orderId: string) {
    // 1. Thông báo 1 đơn
    await this.resolveWhere({
      event_code: NotificationEvent.ORDER_NEW,
      'metadata.order_id': orderId,
    });

    // 2. Thông báo gộp: gỡ đơn này khỏi danh sách còn chờ
    await this.model
      .updateMany(
        {
          event_code: NotificationEvent.ORDER_NEW,
          status: NotificationStatus.OPEN,
          'metadata.pending_order_ids': orderId,
        },
        {
          $pull: { 'metadata.pending_order_ids': orderId },
        } as unknown as UpdateQuery<NotificationLog>,
      )
      .exec();

    // 3. Thông báo gộp đã hết đơn chờ → đóng
    await this.resolveWhere({
      event_code: NotificationEvent.ORDER_NEW,
      'metadata.is_batch': true,
      'metadata.pending_order_ids': { $size: 0 },
    });
  }

  // 4. ĐỌC THÔNG BÁO (luôn lọc theo quyền của người đang đăng nhập)

  async getNotificationsForUser(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ) {
    const uid = new Types.ObjectId(userId);
    const visibility = await this.visibleFor(userId);
    const query: FilterQuery<NotificationLog> = unreadOnly
      ? {
          $and: [
            visibility,
            { read_by: { $ne: uid } },
            { status: NotificationStatus.OPEN },
          ],
        }
      : visibility;

    const skip = (page - 1) * limit;
    const [docs, totalItems] = await Promise.all([
      this.model
        .find(query)
        .sort({ last_occurred_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      items: docs.map((d) => this.toPayload(d, userId)),
      meta: {
        totalItems,
        itemCount: docs.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const uid = new Types.ObjectId(userId);
    const visibility = await this.visibleFor(userId);
    return this.model
      .countDocuments({
        $and: [
          visibility,
          { read_by: { $ne: uid } },
          { status: NotificationStatus.OPEN },
        ],
      })
      .exec();
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationPayload | null> {
    if (!Types.ObjectId.isValid(notificationId)) return null;

    // Chỉ đánh dấu được thông báo mà mình có quyền thấy
    const visibility = await this.visibleFor(userId);
    const updated = await this.model
      .findOneAndUpdate(
        {
          $and: [{ _id: new Types.ObjectId(notificationId) }, visibility],
        },
        { $addToSet: { read_by: new Types.ObjectId(userId) } },
        { new: true },
      )
      .exec();

    if (!updated) return null;

    // Đồng bộ các tab / thiết bị khác của CHÍNH người này
    this.gateway.sendToUsers([userId], 'notification_read', {
      id: notificationId,
    });
    return this.toPayload(updated, userId);
  }

  async markAllAsRead(userId: string, ip?: string, userAgent?: string) {
    const uid = new Types.ObjectId(userId);
    const visibility = await this.visibleFor(userId);
    const result = await this.model
      .updateMany(
        { $and: [visibility, { read_by: { $ne: uid } }] },
        { $addToSet: { read_by: uid } },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.gateway.sendToUsers([userId], 'all_notifications_read', {
        success: true,
      });

      await this.auditLogsService.log({
        action: 'MARK_ALL_NOTIFICATIONS_READ',
        collection_name: Resource.SYSTEM_NOTIFICATIONS,
        actor_id: userId,
        department: Department.MANAGEMENT,
        detail: { count: result.modifiedCount },
        ip,
        user_agent: userAgent,
      });
    }
    return { modifiedCount: result.modifiedCount };
  }

  async get7DayTrend() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.model.aggregate([
      {
        $match: {
          scope: NotificationScope.PORTAL,
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          count: { $sum: '$occurrence_count' },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);
  }

  // 5. HÀM NỘI BỘ

  /** Thông báo user được thấy: đúng quyền VÀ trong NOTIFICATION_VISIBLE_DAYS ngày gần nhất */
  private async visibleFor(
    userId: string,
  ): Promise<FilterQuery<NotificationLog>> {
    const since = new Date(
      Date.now() - NOTIFICATION_VISIBLE_DAYS * 24 * 3600 * 1000,
    );
    const visibility = await this.audience.buildVisibilityFilter(userId);
    return { $and: [visibility, { last_occurred_at: { $gte: since } }] };
  }

  /** Gộp vào thông báo đang mở cùng khóa. Trả về null nếu không có gì để gộp. */
  private async mergeIntoOpen(
    dedupeKey: string,
    windowSec: number,
    message: string,
    priority: NotificationPriority,
  ): Promise<NotificationLog | null> {
    const since = new Date(Date.now() - windowSec * 1000);
    const existing = await this.model
      .findOneAndUpdate(
        {
          dedupe_key: dedupeKey,
          status: NotificationStatus.OPEN,
          last_occurred_at: { $gte: since },
        },
        {
          $inc: { occurrence_count: 1 },
          $set: { last_occurred_at: new Date(), message },
        },
        { new: true, sort: { last_occurred_at: -1 } },
      )
      .exec();

    if (!existing) return null;

    const escalated =
      PRIORITY_RANK[priority] > PRIORITY_RANK[existing.priority];
    if (escalated) {
      // Mức độ tăng => coi như thông báo mới: chưa ai đọc + bật popup lại
      await this.model
        .updateOne({ _id: existing._id }, { $set: { priority, read_by: [] } })
        .exec();
      existing.priority = priority;
      existing.read_by = [];
    }

    await this.emitToRecipients(
      existing,
      escalated ? 'new_notification' : 'notification_updated',
    );
    return existing;
  }

  private async emitToRecipients(doc: NotificationLog, event: string) {
    try {
      const ids = await this.audience.resolveRecipientsForDoc(doc);
      if (ids.length === 0) {
        this.logger.warn(
          `Không có ai đủ quyền nhận: ${doc.event_code ?? doc.title}`,
        );
        return;
      }
      this.gateway.sendToUsers(ids, event, this.toPayload(doc));
    } catch (error) {
      this.logger.error('Gửi socket thất bại', error);
    }
  }

  private toPayload(
    doc: NotificationLog,
    userId?: string,
  ): NotificationPayload {
    const id = String(doc._id);
    const createdAt = doc.createdAt ?? new Date();
    return {
      _id: id,
      id,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      priority: doc.priority,
      status: doc.status ?? NotificationStatus.OPEN,
      event_code: doc.event_code ?? null,
      occurrence_count: doc.occurrence_count ?? 1,
      is_read: userId
        ? (doc.read_by ?? []).some((r) => String(r) === userId)
        : false,
      metadata: doc.metadata ?? {},
      createdAt: new Date(createdAt).toISOString(),
      last_occurred_at: new Date(
        doc.last_occurred_at ?? createdAt,
      ).toISOString(),
    };
  }

  private async writeAudit(doc: NotificationLog) {
    const auditedTypes = [
      NotificationType.SYSTEM,
      NotificationType.SECURITY,
      NotificationType.ORDER,
    ];
    if (!auditedTypes.includes(doc.type)) return;

    try {
      await this.auditLogsService.log({
        action: `${doc.type}_NOTIFICATION_SENT`,
        collection_name: Resource.SYSTEM_NOTIFICATIONS,
        target_id: doc._id,
        department:
          doc.type === NotificationType.ORDER
            ? Department.SALES
            : Department.MANAGEMENT,
        detail: {
          title: doc.title,
          priority: doc.priority,
          event_code: doc.event_code,
          target_resource: doc.target_resource,
          order_code: doc.metadata?.order_code,
          metadata: doc.metadata,
        },
        is_success: true,
      });
    } catch (error) {
      this.logger.error('Ghi audit log thông báo thất bại', error);
    }
  }

  private async acquireLock(key: string): Promise<boolean> {
    try {
      const ok = await this.redis.set(`NOTI_LOCK:${key}`, '1', 'EX', 5, 'NX');
      return ok === 'OK';
    } catch {
      return true; // Redis lỗi thì vẫn cho gửi, không chặn nghiệp vụ
    }
  }

  private async sendSalesEmail(subject: string, body: string) {
    const to =
      this.configService.get<string>('MAIL_SALES_RECEIVER') ||
      'dghkl098@gmail.com';
    try {
      await this.emailService.sendRaw(to, subject, body);
    } catch (error) {
      this.logger.error('Gửi email đơn hàng cho Sales thất bại', error);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
