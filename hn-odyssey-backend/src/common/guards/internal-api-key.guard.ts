import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Khóa các API nội bộ chỉ dành cho n8n gọi về (header: x-internal-key)
// Không có fallback hard-code: chưa cấu hình CHATBOT_INTERNAL_KEY thì chặn hết
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('CHATBOT_INTERNAL_KEY');
    if (!expected) {
      this.logger.error(
        'Chưa cấu hình CHATBOT_INTERNAL_KEY trong .env -> chặn mọi request nội bộ.',
      );
      throw new UnauthorizedException('Internal API is not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-internal-key'];
    if (typeof provided !== 'string') {
      throw new UnauthorizedException('Invalid internal key');
    }

    // So sánh thời gian hằng số để tránh dò khóa theo thời gian phản hồi
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal key');
    }

    return true;
  }
}
