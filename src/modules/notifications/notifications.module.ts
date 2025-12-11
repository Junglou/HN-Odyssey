import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { MailConfigService } from '../../config/mail.config';
import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { PushService } from './channels/push.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: MailConfigService,
    }),
  ],
  providers: [EmailService, SmsService, PushService],
  exports: [EmailService, SmsService, PushService],
})
export class NotificationsModule {}
