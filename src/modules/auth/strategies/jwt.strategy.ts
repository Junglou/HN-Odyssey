import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/modules/users/schemas/user.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
// Đảm bảo import đúng đường dẫn Enum UserStatus
import { UserStatus } from 'src/common/enums/user-status.enum';

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

  async validate(payload: any) {
    // 1. SỬA LỖI: Thay 'is_active' bằng 'status' trong câu lệnh select
    const user = await this.userModel
      .findById(payload.sub)
      .select('status roles email token_version'); // Lấy trường status

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    // 2. SỬA LỖI: Kiểm tra theo Enum UserStatus thay vì boolean is_active
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

    // 3. Return Roles lấy từ DB để đảm bảo tính mới nhất
    return {
      userId: payload.sub,
      email: payload.email,
      roles: user.roles, // Mảng string ['SUPER_ADMIN', 'CUSTOMER']
    };
  }
}
