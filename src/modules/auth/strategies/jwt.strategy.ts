import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/modules/users/schemas/user.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserStatus } from 'src/common/enums/user-status.enum';

// 1. Định nghĩa Interface cho Payload
interface JwtPayload {
  sub: string;
  email: string;
  token_version?: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // 2. Thay 'payload: any' bằng 'payload: JwtPayload'
  async validate(payload: JwtPayload) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('status roles email token_version')
      .lean()
      .exec();

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Tài khoản của bạn không có quyền thực hiện. Vui lòng liên hệ Admin.',
      );
    }
    const payloadVersion = payload.token_version || 0;
    const dbVersion = user.token_version || 0;

    if (payloadVersion !== dbVersion) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại.',
      );
    }

    // payload.sub và payload.email truy cập an toàn
    return {
      _id: payload.sub,
      email: payload.email,
      roles: user.roles,
    };
  }
}
