import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { getMailConfig } from '../../config/mail.config';
import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';

// @Global() giúp các module khác dùng được EmailService mà không cần import NotificationsModule liên tục
// Tuy nhiên, best practice là nên import rõ ràng. Ở đây tôi để export thường.

@Module({
  imports: [
    ConfigModule,
    // Tích hợp MailerModule
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getMailConfig, // Sử dụng config từ bước 2
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    SmsService,
    NotificationsGateway,
  ],
  exports: [
    EmailService, // Export để AuthModule dùng
    SmsService, // Export để AuthModule dùng
  ],
})
export class NotificationsModule {}
