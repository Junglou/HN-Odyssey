import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import { Cart, CartSchema } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  UserBehavior,
  UserBehaviorSchema,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import {
  PriceHistory,
  PriceHistorySchema,
} from 'src/modules/products/catalog/schemas/price-history.schema.ts';
import { User, UserSchema } from 'src/modules/users/schemas/user.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { BusinessMonitoringCronService } from './business-monitoring.cron';
import { ProductSchema } from 'src/modules/products/catalog/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: UserBehavior.name, schema: UserBehaviorSchema },
      { name: User.name, schema: UserSchema },
      { name: PriceHistory.name, schema: PriceHistorySchema },
      { name: 'Product', schema: ProductSchema },
    ]),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [BusinessReportsController],
  providers: [BusinessReportsService, BusinessMonitoringCronService],
  exports: [BusinessReportsService],
})
export class BusinessReportsModule {}
