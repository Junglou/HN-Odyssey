import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@WebSocketGateway({ cors: true })
export class NotificationsGateway {
  constructor(private readonly notificationsService: NotificationsService) {}

  @SubscribeMessage('createNotification')
  create(@MessageBody() createNotificationDto: SendNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }
}
