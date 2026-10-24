import { forwardRef, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { getMailConfig } from '../../config/mail.config';
import { EmailService } from './channels/email.service';
import { SmsService } from './channels/sms.service';
import { WebhookService } from './channels/webhook.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationAudienceService } from './notification-audience.service';
import { NotificationListener } from './listeners/notification.listener';
import {
  NotificationLog,
  NotificationLogSchema,
} from './schemas/notification-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Role, RoleSchema } from '../users/roles/schemas/role.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
      // Cần để tính người nhận theo ma trận quyền
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getMailConfig,
      inject: [ConfigService],
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationAudienceService,
    EmailService,
    SmsService,
    WebhookService,
    NotificationsGateway,
    NotificationListener,
  ],
  exports: [EmailService, SmsService, WebhookService, NotificationsService],
})
export class NotificationsModule {}
