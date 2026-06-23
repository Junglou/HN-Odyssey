import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeInController } from './trade-in.controller';
import { TradeInService } from './trade-in.service';
import {
  TradeInRequest,
  TradeInRequestSchema,
} from './schemas/trade-in-request.schema';
import {
  Category,
  CategorySchema,
} from '../products/categories/schemas/category.schema';
import { ProductSchema } from '../products/catalog/schemas/product.schema';
import { OrderSchema } from '../sales/orders/schemas/order.schema';
import { OrdersModule } from '../sales/orders/orders.module';
import { ShippingModule } from '../shipping/shipping.module';
import { UsersModule } from '../users/users.module';
import {
  Coupon,
  CouponSchema,
} from '../marketing/promotions/schemas/coupon.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { TradeInNotificationListener } from './trade-in-notification.listener';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradeInRequest.name, schema: TradeInRequestSchema },
      { name: Category.name, schema: CategorySchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Order', schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrdersModule,
    ShippingModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [TradeInController],
  providers: [TradeInService, TradeInNotificationListener],
  exports: [TradeInService],
})
export class TradeInModule {}
