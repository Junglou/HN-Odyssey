import passport from 'passport';
import { AuthService } from '../auth.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class LocalStrategy {
  constructor(private authService: AuthService) {
    super({
      userNameField: 'account',
      passWordField: 'password',
    });
  }

  async validate(account: string, password: string) {
    const user = await this.authService.validateUser(account, password);

    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }
    return user;
  }
}
