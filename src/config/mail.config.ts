import { MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const getMailConfig = async (
  configService: ConfigService,
): Promise<MailerOptions> => {
  return {
    transport: {
      host: configService.get('MAIL_HOST'),
      port: configService.get('MAIL_PORT'),
      secure: configService.get('MAIL_SECURE') === 'true', // false cho port 587
      auth: {
        user: configService.get('MAIL_USER'),
        pass: configService.get('MAIL_PASSWORD'),
      },
    },
    defaults: {
      from: `"${configService.get('MAIL_FROM_NAME')}" <${configService.get('MAIL_FROM_ADDRESS')}>`,
    },
    template: {
      dir: join(__dirname, '../../common/templates'), // Tạo folder templates ở src/common/templates
      adapter: new HandlebarsAdapter(),
      options: {
        strict: true,
      },
    },
  };
};
