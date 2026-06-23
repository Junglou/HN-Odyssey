import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import {
  NotificationLog,
  NotificationType,
  NotificationPriority,
} from './schemas/notification-log.schema';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from './channels/email.service';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';

import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AuditLogsService } from '../system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';

interface CreateNotificationData {
  recipient_role: string;
  recipient_id?: string | Types.ObjectId;
  warehouse_id?: string | Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

interface INotificationLogLean {
  _id: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  metadata?: Record<string, any>;
  createdAt: string | number | Date;
}

@Injectable()
export class NotificationsService {
  private orderStream = new Subject<Order>();
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(NotificationLog.name)
    private readonly model: Model<NotificationLog>,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.initOrderBatching();
  }

  private initOrderBatching() {
    this.orderStream
      .pipe(
        bufferTime(500),
        filter((orders) => orders.length > 0),
      )
      .subscribe({
        // 1. Không dùng 'async' ở callback 'next' để tuân thủ kiểu 'void' của RxJS
        next: (batch) => {
          // 2. Dùng void (async () => { ... })() để chạy logic Promise một cách an toàn
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

  private async broadcastOrder(order: Order) {
    const area = order.shipping_info?.city_code || 'DEFAULT';
    const customerName = order.shipping_info?.name || 'Khách vãng lai';

    const orderWithTimestamps = order as Order & { createdAt?: Date | string };
    const createdAtDate = orderWithTimestamps.createdAt;

    const orderTime =
      createdAtDate instanceof Date
        ? createdAtDate.toLocaleString('vi-VN')
        : typeof createdAtDate === 'string'
          ? new Date(createdAtDate).toLocaleString('vi-VN')
          : new Date().toLocaleString('vi-VN');

    await this.createAndSend({
      recipient_role: 'SALES_STAFF',
      warehouse_id: area,
      title: 'Đơn hàng mới!',
      message: `Đơn #${order.order_code} của ${customerName} - ${(order.total_amount || 0).toLocaleString()}đ lúc ${orderTime}`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: {
        order_id: String(order._id),
        order_code: order.order_code,
        target_url: `/portal/orders`,
      },
    });
  }

  private async broadcastOrderBatch(batch: Order[]) {
    const orderIds = batch.map((o) => String(o._id));
    const totalValue = batch.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    await this.createAndSend({
      recipient_role: 'SALES_STAFF',
      title: 'Nhiều đơn hàng mới',
      message: `Bạn có ${batch.length} đơn hàng mới (Tổng: ${totalValue.toLocaleString()}đ) cần xử lý.`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      metadata: {
        is_batch: true,
        order_ids: orderIds,
        target_url: `/portal/orders`,
      },
    });
  }

  async createAndSend(data: CreateNotificationData) {
    try {
      const isSpam = await this.checkSpamSafe(data);
      if (isSpam) return;

      // 1. Lưu vào Database
      const log = await new this.model({ ...data, is_read: false }).save();
      const logData = log.toObject() as unknown as INotificationLogLean;

      // CẬP NHẬT: Gộp Audit Log (Xử lý lỗi ghi log 2 lần)
      const auditedTypes = [
        NotificationType.SYSTEM,
        NotificationType.SECURITY,
        NotificationType.ORDER,
      ];

      if (auditedTypes.includes(data.type)) {
        await this.auditLogsService.log({
          action: `${data.type}_NOTIFICATION_SENT`,
          collection_name: Resource.NOTIFICATIONS,
          target_id: log._id,
          // Phân luồng Department chuẩn xác cho từng loại tin
          department:
            data.type === NotificationType.ORDER
              ? Department.SALES
              : Department.MANAGEMENT,
          detail: {
            title: data.title,
            priority: data.priority,
            recipient_role: data.recipient_role,
            order_code: data.metadata?.order_code, // Luôn ưu tiên lưu mã đơn nếu có
            metadata: data.metadata,
          },
          is_success: true,
        });
      }

      // 2. Xác định các Room cần gửi Socket
      const warehouseId = data.warehouse_id ? String(data.warehouse_id) : '';
      const payload = {
        id: logData._id.toString(),
        title: logData.title,
        message: logData.message,
        type: logData.type,
        priority: logData.priority,
        metadata: logData.metadata,
        createdAt: logData.createdAt
          ? new Date(logData.createdAt).toISOString()
          : new Date().toISOString(),
      };

      // Gửi Socket
      if (warehouseId) {
        this.gateway.sendToRoom(
          `role_${data.recipient_role}_area_${warehouseId}`,
          'new_notification',
          payload,
        );
      } else {
        // Chỉ gửi vào phòng chung nếu KHÔNG CÓ kho cụ thể
        this.gateway.sendToRoom(
          `role_${data.recipient_role}`,
          'new_notification',
          payload,
        );
      }
      this.gateway.sendToRoom(
        `role_${data.recipient_role}`,
        'new_notification',
        payload,
      );
      if (data.recipient_id) {
        this.gateway.sendToRoom(
          `user_${String(data.recipient_id)}`,
          'new_notification',
          payload,
        );
      }

      return log;
    } catch (error) {
      this.logger.error('Critical failure in createAndSend', error);
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    const updated = await this.model.findOneAndUpdate(
      { _id: notificationId },
      { is_read: true, read_at: new Date() },
      { new: true },
    );

    if (updated) {
      this.gateway.sendToRoom(`user_${userId}`, 'notification_read', {
        id: notificationId,
      });
    }
    return updated;
  }

  async markAllAsRead(
    userId: string,
    roles: string[],
    ip?: string,
    userAgent?: string,
  ) {
    const result = await this.model
      .updateMany(
        {
          $or: [
            { recipient_id: new Types.ObjectId(userId) },
            { recipient_role: { $in: roles } },
          ],
          is_read: false,
        },
        { is_read: true, read_at: new Date() },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.gateway.sendToRoom(`user_${userId}`, 'all_notifications_read', {
        success: true,
      });

      await this.auditLogsService.log({
        action: 'MARK_ALL_NOTIFICATIONS_READ',
        collection_name: Resource.NOTIFICATIONS,
        actor_id: userId,
        department: Department.MANAGEMENT,
        detail: { count: result.modifiedCount },
        ip,
        user_agent: userAgent,
      });
    }
    return result;
  }

  async getNotificationsForUser(
    userId: string,
    roles: string[],
    warehouseId?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const orConditions: any[] = [{ recipient_id: new Types.ObjectId(userId) }];

    if (roles && roles.length > 0) {
      if (roles.includes('SUPER_ADMIN')) {
        orConditions.push({ recipient_role: { $in: roles } });
      } else {
        const whCondition = warehouseId
          ? {
              $or: [
                { warehouse_id: null },
                { warehouse_id: { $exists: false } },
                { warehouse_id: new Types.ObjectId(warehouseId) },
              ],
            }
          : {
              $or: [
                { warehouse_id: null },
                { warehouse_id: { $exists: false } },
              ],
            };

        orConditions.push({
          recipient_role: { $in: roles },
          ...whCondition,
        });
      }
    }

    const query = { $or: orConditions };

    const [items, totalItems] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async pushToOrderStream(order: Order) {
    return this.notifyNewOrder(order);
  }

  async autoResolveStockAlert(sku: string) {
    const result = await this.model
      .updateMany(
        { 'metadata.sku': sku, type: NotificationType.STOCK, is_read: false },
        {
          $set: {
            is_read: true,
            read_at: new Date(),
            'metadata.resolved': true,
          },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      await this.auditLogsService.log({
        action: 'STOCK_ALERT_RESOLVED',
        collection_name: Resource.INVENTORY,
        department: Department.WAREHOUSE,
        detail: {
          sku,
          message:
            'Tồn kho đã trở lại mức an toàn, hệ thống tự động đóng cảnh báo.',
        },
      });
      // FIX: Gửi cho cả ADMIN và MANAGER để ai cũng thấy
      const targetRoles = [
        'SUPER_ADMIN',
        'WAREHOUSE_MANAGER',
        'WAREHOUSE_STAFF',
      ];
      const payload = {
        title: 'Đã xử lý: Tồn kho ổn định',
        message: `Sản phẩm ${sku} đã được nhập thêm hàng, cảnh báo đã tự động đóng.`,
        type: NotificationType.STOCK,
        priority: NotificationPriority.LOW,
        metadata: { sku, resolved: true },
      };

      for (const role of targetRoles) {
        this.gateway.sendToRoom(`role_${role}`, 'new_notification', payload);
      }
      this.logger.log(`[RESOLVE] Đã bắn Socket báo SKU ${sku} an toàn.`);
    }

    // Xóa khóa chống spam để lần sau hết hàng lại báo được ngay
    await this.redis.del(`SPAM_STK_${sku}`);
  }

  async autoResolveAlert(
    type: NotificationType,
    metadataKey: string,
    metadataValue: string,
  ) {
    const queryKey = `metadata.${metadataKey}`;
    const result = await this.model
      .updateMany(
        { [queryKey]: metadataValue, type: type, is_read: false },
        {
          $set: {
            is_read: true,
            read_at: new Date(),
            'metadata.resolved': true,
          },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      // Ghi Audit Log hành động khắc phục tự động
      await this.auditLogsService.log({
        action: 'SYSTEM_INCIDENT_RESOLVED',
        collection_name: Resource.SYSTEM,
        department: Department.MANAGEMENT,
        detail: {
          type,
          [metadataKey]: metadataValue,
          message: 'Sự cố đã được xử lý và đóng cảnh báo tự động.',
        },
      });

      this.gateway.sendToRoom('role_SUPER_ADMIN', 'notification_resolved', {
        type,
        [metadataKey]: metadataValue,
      });
    }

    if (type === NotificationType.SYSTEM) {
      await this.redis.del(`SPAM_SYS_${metadataValue}`);
    }
  }

  async getUnreadCount(
    userId: string,
    roles: string[],
    warehouseId?: string,
  ): Promise<number> {
    const orConditions: any[] = [{ recipient_id: new Types.ObjectId(userId) }];

    if (roles && roles.length > 0) {
      if (roles.includes('SUPER_ADMIN')) {
        orConditions.push({ recipient_role: { $in: roles } });
      } else {
        const whCondition = warehouseId
          ? {
              $or: [
                { warehouse_id: null },
                { warehouse_id: { $exists: false } },
                { warehouse_id: new Types.ObjectId(warehouseId) },
              ],
            }
          : {
              $or: [
                { warehouse_id: null },
                { warehouse_id: { $exists: false } },
              ],
            };

        orConditions.push({
          recipient_role: { $in: roles },
          ...whCondition,
        });
      }
    }

    return this.model
      .countDocuments({
        $or: orConditions,
        is_read: false,
      })
      .exec();
  }

  async get7DayTrend() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.model.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);
  }

  private async checkSpamSafe(data: CreateNotificationData): Promise<boolean> {
    try {
      if (
        data.type === NotificationType.STOCK ||
        data.type === NotificationType.SYSTEM
      ) {
        const sku =
          typeof data.metadata?.sku === 'string' ? data.metadata.sku : '';
        const err =
          typeof data.metadata?.error_code === 'string'
            ? data.metadata.error_code
            : '';
        const key =
          data.type === NotificationType.STOCK
            ? `SPAM_STK_${sku}`
            : `SPAM_SYS_${err}`;

        if (key.endsWith('_')) return false;

        const exists = await this.redis.get(key);
        if (exists) return true;

        const cooldown = 5;
        await this.redis.set(key, '1', 'EX', cooldown);
      }
    } catch {
      return false;
    }
    return false;
  }

  private emitToRoomSafe(data: CreateNotificationData, payload: any) {
    try {
      const warehouseId = data.warehouse_id ? String(data.warehouse_id) : '';
      const room = `role_${data.recipient_role}${warehouseId ? `_area_${warehouseId}` : ''}`;
      this.gateway.sendToRoom(room, 'new_notification', payload);
    } catch {
      this.logger.error('Socket Emit thất bại');
    }
  }

  async createAndSendToMultipleRoles(data: {
    roles: string[];
    warehouse_id?: string | Types.ObjectId;
    title: string;
    message: string;
    type: NotificationType;
    priority: NotificationPriority;
    metadata: Record<string, any>;
  }) {
    const checkData: CreateNotificationData = {
      recipient_role: data.roles[0],
      type: data.type,
      metadata: data.metadata,
      title: data.title,
      message: data.message,
    };

    const isSpam = await this.checkSpamSafe(checkData);
    if (isSpam) {
      return;
    }

    // TẠO BẢN GHI RIÊNG CHO TỪNG ROLE (Khắc phục lỗi hardcode SUPER_ADMIN)
    const logs = await Promise.all(
      data.roles.map((role) => {
        return new this.model({
          ...data,
          recipient_role: role,
          is_read: false,
        }).save();
      }),
    );

    if (data.type === NotificationType.STOCK && logs.length > 0) {
      await this.auditLogsService.log({
        action: 'STOCK_ALERT_SENT',
        collection_name: Resource.INVENTORY,
        target_id: logs[0]._id,
        department: Department.WAREHOUSE,
        detail: {
          sku: typeof data.metadata?.sku === 'string' ? data.metadata.sku : '',
          message: data.message,
        },
      });
    }

    // BẮN SOCKET TƯƠNG ỨNG VỚI TỪNG ROLE
    for (let i = 0; i < data.roles.length; i++) {
      const role = data.roles[i];
      const logData = logs[i].toObject() as unknown as INotificationLogLean;

      const payload = {
        id: logData._id.toString(),
        title: logData.title,
        message: logData.message,
        type: logData.type,
        priority: logData.priority,
        metadata: logData.metadata,
        createdAt: logData.createdAt
          ? new Date(logData.createdAt).toISOString()
          : new Date().toISOString(),
      };

      const warehouseId =
        role === 'SUPER_ADMIN'
          ? ''
          : data.warehouse_id
            ? String(data.warehouse_id)
            : '';
      const room = `role_${role}${warehouseId ? `_area_${warehouseId}` : ''}`;

      this.gateway.sendToRoom(room, 'new_notification', payload);
    }
    return logs[0];
  }
}
