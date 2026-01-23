import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

// 1. Định nghĩa Interface cho Payload trong Token
interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

// 2. Định nghĩa Interface mở rộng cho Request để có cookies
// Giúp ESLint hiểu req.cookies là object
interface RequestWithCookies extends Request {
  cookies: { refresh_token?: string };
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          // Ép kiểu request về dạng có cookies
          const req = request as unknown as RequestWithCookies;
          // Return rõ ràng string | null để tránh "Unsafe return of any"
          return req.cookies?.refresh_token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  // 3. Áp dụng Interface vào tham số
  async validate(request: Request, payload: JwtPayload) {
    const req = request as unknown as RequestWithCookies;
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    // Lúc này payload đã có type, truy cập .sub, .email an toàn
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      refreshToken,
    };
  }
}
