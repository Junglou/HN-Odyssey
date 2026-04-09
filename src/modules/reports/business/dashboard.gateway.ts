import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Order } from 'src/modules/sales/orders/schemas/order.schema';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface IRealtimeOrderPayload {
  order_code: string;
  total_amount: number;
  customer_name: string;
  status: string;
  created_at: Date;
}

export interface IRealtimeStockPayload {
  sku: string;
  product_name: string;
  current_stock: number;
  warehouse_id: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/admin/dashboard',
})
export class DashboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  // Lưu trữ các kết nối Admin đang Online
  private activeAdminSessions: Map<string, string> = new Map();

  // FIX LỖI: Inject trực tiếp ioredis client thay vì CACHE_MANAGER
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Admin kết nối vào Dashboard: ${client.id}`);
    this.activeAdminSessions.set(client.id, 'ADMIN_SESSION');
    await this.broadcastActiveUsers();
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Admin ngắt kết nối: ${client.id}`);
    this.activeAdminSessions.delete(client.id);
    await this.broadcastActiveUsers();
  }

  // Cập nhật hàm broadcastActiveUsers để đọc từ Sorted Set
  private async broadcastActiveUsers() {
    try {
      const now = Date.now();
      const fiveMinsAgo = now - 5 * 60 * 1000;

      // Đọc count chính xác từ tập hợp Redis (Không còn lỗi Unsafe Member Access)
      const customersOnline = await this.redis.zcount(
        'active_customers',
        fiveMinsAgo,
        now,
      );

      this.server.emit('dashboard.active_users', {
        admins_online: this.activeAdminSessions.size,
        customers_online: customersOnline,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Lỗi khi lấy số lượng active users từ Redis', error);
    }
  }

  // AC3: Lắng nghe Event từ App Khách Hàng bắn sang
  // Mỗi khi có khách ra/vào, Event này kích hoạt và đẩy Socket ngay lập tức

  @OnEvent('customer.online.changed')
  handleCustomerOnlineChanged(payload: { currentCount: number }) {
    this.server.emit('dashboard.active_users', {
      admins_online: this.activeAdminSessions.size,
      customers_online: payload.currentCount,
      timestamp: new Date(),
    });
  }

  //  CÁC HÀM XỬ LÝ ĐƠN HÀNG VÀ TỒN KHO GIỮ NGUYÊN

  @OnEvent(NOTIFY_EVENTS.ORDER_CREATED)
  handleNewOrderRealtime(order: Order) {
    const payload: IRealtimeOrderPayload = {
      order_code: order.order_code,
      total_amount: order.total_amount,
      customer_name: order.shipping_info?.name || 'Khách vãng lai',
      status: order.status,
      created_at: order.createdAt || new Date(),
    };

    this.server.emit('dashboard.order.new', payload);
    this.server.emit('dashboard.revenue.jump', {
      amount_added: order.total_amount,
      timestamp: new Date(),
    });
  }

  @OnEvent(NOTIFY_EVENTS.STOCK_ALERT)
  handleStockAlertRealtime(data: {
    product: { name: string; warehouse_id: string };
    variant: { sku: string };
    currentStock: number;
    type: string;
  }) {
    if (data.type === 'MIN') {
      const payload: IRealtimeStockPayload = {
        sku: data.variant.sku,
        product_name: data.product.name,
        current_stock: data.currentStock,
        warehouse_id: data.product.warehouse_id,
      };

      this.server.emit('dashboard.stock.alert_critical', payload);
    }
  }
}
