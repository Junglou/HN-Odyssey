import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

// 1. Định nghĩa Interface cho Profile Facebook
interface FacebookProfile {
  id: string;
  displayName?: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  emails?: { value: string }[];
  photos?: { value: string }[];
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('FACEBOOK_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('FACEBOOK_CALLBACK_URL'),
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'displayName', 'photos', 'email', 'name'], // Thêm 'name' vào đây để chắc chắn FB trả về
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: FacebookProfile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, photos, id, displayName } = profile;

    // 3. Sử dụng Optional Chaining (?.) để truy cập an toàn
    // Tránh lỗi crash nếu Facebook không trả về email hoặc name
    const user = {
      email: emails && emails.length > 0 ? emails[0].value : null,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      // Logic ghép tên: Nếu có name thì ghép, không thì dùng displayName
      name:
        name && (name.givenName || name.familyName)
          ? `${name.givenName || ''} ${name.familyName || ''}`.trim()
          : displayName,
      picture: photos && photos.length > 0 ? photos[0].value : null,
      id: id,
      accessToken,
    };

    done(null, user);
  }
}
