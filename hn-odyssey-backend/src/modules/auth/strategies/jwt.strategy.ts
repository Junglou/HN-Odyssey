import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserStatus } from 'src/common/enums/user-status.enum';

interface JwtPayload {
  sub: string;
  email: string;
  token_version?: number;
  iat?: number;
  exp?: number;
}

interface IJwtUser {
  _id: unknown;
  status: UserStatus;
  is_active?: boolean;
  lock_until?: Date | null;
  roles: string[];
  email: string;
  token_version?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  async validate(payload: JwtPayload) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('status is_active lock_until roles email token_version')
      .lean<IJwtUser>()
      .exec();

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    if (user.status !== UserStatus.ACTIVE || user.is_active === false) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Admin.',
      );
    }

    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      throw new UnauthorizedException('Tài khoản đang bị tạm khóa.');
    }

    const payloadVersion = payload.token_version || 0;
    const dbVersion = user.token_version || 0;

    if (payloadVersion !== dbVersion) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại.',
      );
    }

    return {
      _id: payload.sub,
      email: payload.email,
      roles: user.roles,
    };
  }
}
