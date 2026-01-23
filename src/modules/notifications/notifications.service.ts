import { Injectable } from '@nestjs/common';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  // Placeholder function
  create(createNotificationDto: SendNotificationDto) {
    console.log(createNotificationDto);
    return 'This action adds a new notification';
  }

  findAll() {
    return `This action returns all notifications`;
  }
}
