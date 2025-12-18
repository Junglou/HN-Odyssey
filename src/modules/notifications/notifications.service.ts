import { Injectable } from '@nestjs/common';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  // Placeholder function
  async create(createNotificationDto: SendNotificationDto) {
    return 'This action adds a new notification';
  }

  async findAll() {
    return `This action returns all notifications`;
  }
}
