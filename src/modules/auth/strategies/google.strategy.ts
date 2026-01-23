import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID')!;
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET')!;
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL')!;

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { name, emails, photos, displayName, id } = profile;

    const user = {
      id: id,
      email: emails?.[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos?.[0]?.value,
      displayName: displayName,
      accessToken,
      provider: 'google',
    };

    done(null, user);
  }
}
