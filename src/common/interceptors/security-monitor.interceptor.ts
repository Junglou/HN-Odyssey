import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Request } from 'express';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import * as geoip from 'geoip-lite';
import { ConfigService } from '@nestjs/config';

interface RequestUser {
  userId: string;
  roles: string[];
}

interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}

interface DeviceInfo {
  lastIp: string;
  lastUA: string;
  lastTimestamp: number;
}

interface LoginResponseUser {
  _id?: string | { toString: () => string };
  userId?: string;
  roles?: string[];
}

interface LoginResponsePayload {
  user?: LoginResponseUser;
}

@Injectable()
export class SecurityMonitorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityMonitorInterceptor.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const url = request.url;

    const forwardedFor = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      request.socket.remoteAddress ||
      'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    return next.handle().pipe(
      tap((responsePayload: unknown) => {
        const payload = responsePayload as LoginResponsePayload;
        const loggedInUser = request.user || payload?.user;

        // Chỉ trigger khi route login và có user trả về
        if (loggedInUser && url.includes('/auth/login')) {
          let idStr = '';
          if ('userId' in loggedInUser && loggedInUser.userId) {
            idStr = loggedInUser.userId;
          } else if ('_id' in loggedInUser && loggedInUser._id) {
            idStr = loggedInUser._id.toString();
          }

          const userForCheck: RequestUser = {
            userId: idStr,
            roles: Array.isArray(loggedInUser.roles) ? loggedInUser.roles : [],
          };

          void this.handleSecurityCheck(userForCheck, ip, userAgent);
        }
      }),
    );
  }

  private async handleSecurityCheck(
    user: RequestUser,
    ip: string,
    userAgent: string,
  ) {
    try {
      // [AC10] KIỂM TRA WHITELIST IP TỪ BIẾN MÔI TRƯỜNG
      const whitelistStr =
        this.configService.get<string>('WHITELIST_IPS') || '';
      const whitelistIps = whitelistStr.split(',').map((i) => i.trim());

      // Nếu IP nằm trong danh sách trắng -> Bỏ qua toàn bộ cảnh báo
      if (whitelistIps.includes(ip)) {
        this.logger.log(`IP ${ip} thuộc Whitelist. Bỏ qua kiểm tra bảo mật.`);
        return;
      }

      const redisKey = `user_device:${user.userId}`;
      const lastDeviceInfoJson = await this.redis.get(redisKey);
      const currentTimestamp = Date.now();

      if (lastDeviceInfoJson) {
        const lastData = JSON.parse(lastDeviceInfoJson) as DeviceInfo;

        // AC2: PHÁT HIỆN VỊ TRÍ BẤT THƯỜNG (IMPOSSIBLE TRAVEL)
        const geoOld = geoip.lookup(lastData.lastIp);
        const geoNew = geoip.lookup(ip);

        if (geoOld && geoNew) {
          const distance = this.calculateDistance(geoOld.ll, geoNew.ll);
          const timeDiffHours =
            (currentTimestamp - lastData.lastTimestamp) / 3600000;

          // Nếu vận tốc > 800km/h (tốc độ máy bay)
          if (
            timeDiffHours > 0 &&
            distance / timeDiffHours > 800 &&
            distance > 50
          ) {
            this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
              severity: 'CRITICAL',
              message: `Cảnh báo Impossible Travel: Đăng nhập từ ${geoNew.city} cách vị trí cũ ${distance.toFixed(1)}km chỉ sau ${timeDiffHours.toFixed(2)}h`,
              user_id: user.userId,
              ip: ip,
            });
          }
        }

        // AC3: PHÁT HIỆN THIẾT BỊ/IP LẠ
        if (lastData.lastIp !== ip || lastData.lastUA !== userAgent) {
          this.eventEmitter.emit(NOTIFY_EVENTS.SECURITY_ALERT, {
            severity: 'HIGH',
            message: `Đăng nhập lạ từ thiết bị hoặc IP mới: ${ip}`,
            user_id: user.userId,
            ip: ip,
          });
        }
      }

      // Luôn cập nhật thông tin mới nhất vào Redis
      await this.redis.set(
        redisKey,
        JSON.stringify({
          lastIp: ip,
          lastUA: userAgent,
          lastTimestamp: currentTimestamp,
        }),
        'EX',
        86400 * 30, // 30 ngày
      );
    } catch (e) {
      this.logger.error('Lỗi nghiêm trọng trong SecurityMonitor:', e);
    }
  }

  private calculateDistance(
    latlng1: [number, number],
    latlng2: [number, number],
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(latlng2[0] - latlng1[0]);
    const dLon = this.deg2rad(latlng2[1] - latlng1[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(latlng1[0])) *
        Math.cos(this.deg2rad(latlng2[0])) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
