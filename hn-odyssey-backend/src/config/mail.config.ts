import { MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const getMailConfig = async (
  configService: ConfigService,
): Promise<MailerOptions> => {
  return {
    transport: {
      host: configService.get<string>('MAIL_HOST'),
      port: configService.get<number>('MAIL_PORT'),
      secure: configService.get<string>('MAIL_SECURE') === 'true', // false cho port 587
      pool: true,
      maxConnections: 5, // Giới hạn 5 luồng kết nối cùng lúc
      maxMessages: 100, // Tối đa 100 email trên mỗi luồng
      rateDelta: 1000, // Giới hạn tốc độ gửi (ví dụ cùng rateLimit)
      rateLimit: 5, // Tối đa 5 email mỗi giây
      auth: {
        user: configService.get<string>('MAIL_USER'),
        pass: configService.get<string>('MAIL_PASSWORD'),
      },
    },
    defaults: {
      from: `"${configService.get<string>(
        'MAIL_FROM_NAME',
      )}" <${configService.get<string>('MAIL_FROM_ADDRESS')}>`,
    },
    template: {
      dir: join(__dirname, '../../common/templates'),
      adapter: new HandlebarsAdapter(),
      options: {
        strict: true,
      },
    },
  };
};
