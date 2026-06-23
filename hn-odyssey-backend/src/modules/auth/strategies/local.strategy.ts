import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'account',
      passwordField: 'password',
      passReqToCallback: true, // Bật cái này lên để lấy req
    });
  }

  async validate(req: Request, account: string, pass: string): Promise<any> {
    const ip = req.ip || (req.socket.remoteAddress as string);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const user = await this.authService.validateUser(
      account,
      pass,
      ip,
      userAgent,
    );
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
