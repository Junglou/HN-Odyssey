import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/storefront' })
export class CustomerGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CustomerGateway.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Khách hàng kết nối: ${client.id}`);
    const now = Date.now();

    // Thêm session vào Sorted Set với score là timestamp hiện tại
    await this.redis.zadd('active_customers', now, client.id);
    await this.emitActiveUsersCount();
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Khách hàng ngắt kết nối: ${client.id}`);

    // Xóa session khỏi Sorted Set khi ngắt kết nối
    await this.redis.zrem('active_customers', client.id);
    await this.emitActiveUsersCount();
  }

  private async emitActiveUsersCount() {
    const now = Date.now();
    const fiveMinsAgo = now - 5 * 60 * 1000;

    // Tối ưu: Tự động dọn dẹp các session rác cũ hơn 5 phút
    await this.redis.zremrangebyscore('active_customers', 0, fiveMinsAgo);

    // Đếm số lượng session thực tế đang hoạt động trong 5 phút qua
    const currentCount = await this.redis.zcount(
      'active_customers',
      fiveMinsAgo,
      now,
    );

    this.eventEmitter.emit('customer.online.changed', { currentCount });
  }
}
