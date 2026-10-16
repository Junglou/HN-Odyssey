import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { OrdersModule } from 'src/modules/sales/orders/orders.module';
import { WsJwtGuard } from 'src/common/guards/ws-jwt.guard';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import { ChatProductCardService } from './chat-product-card.service';
import {
  Attribute,
  AttributeSchema,
} from 'src/modules/products/attributes/schemas/attribute.schema';
import { PromotionsModule } from 'src/modules/marketing/promotions/promotions.module';
import { RecommendationsModule } from 'src/modules/recommendations/recommendations.module';
import { ChatInternalController } from './chat-internal.controller';
import { ChatPersonalizationService } from './chat-personalization.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Attribute.name, schema: AttributeSchema },
    ]),
    // Cấu hình JwtModule để WsJwtGuard có thể sử dụng JwtService
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    forwardRef(() => OrdersModule),
    NotificationsModule,
    RecommendationsModule,
    PromotionsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ChatController, ChatInternalController],
  providers: [
    ChatService,
    ChatGateway,
    WsJwtGuard,
    ChatProductCardService,
    ChatPersonalizationService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
