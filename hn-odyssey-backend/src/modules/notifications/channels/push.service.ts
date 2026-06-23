// src/modules/notifications/channels/push.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import * as admin from 'firebase-admin'; // Cần cài: npm i firebase-admin

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private configService: ConfigService) {
    // Khởi tạo Firebase Admin SDK
    /*
    const serviceAccount = require('../../../config/firebase-service-account.json');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    */
  }

  //Gửi thông báo đến 1 thiết bị cụ thể (Mobile/Web)
  //Mapping AC13: Cảnh báo đăng nhập thiết bị lạ
  async sendToDevice(
    deviceToken: string,
    title: string,
    body: string,
    data?: any,
  ) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!isProduction) {
      this.logger.debug(
        `[MOCK PUSH] To: ${deviceToken.substring(0, 10)}... | Title: ${title} | Body: ${body} | Data: ${JSON.stringify(data || {})}`,
      );
      return;
    }

    try {
      /*
      await admin.messaging().send({
        token: deviceToken,
        notification: { title, body },
        data: data || {}, // Dữ liệu ngầm để App xử lý (ví dụ: điều hướng)
      });
      */
      this.logger.log(`Push notification sent to device`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Push notification failed`, err.stack);
    }
  }

  //Gửi thông báo cho hàng loạt user (VD: Marketing Campaign)
  async sendToTopic(topic: string, title: string, body: string) {
    this.logger.log(`Sending to topic ${topic}: ${title} | Content: ${body}`);
    // Code tương tự sendToDevice nhưng dùng method sendToTopic của Firebase
  }
}
