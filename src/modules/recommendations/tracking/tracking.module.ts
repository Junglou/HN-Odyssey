import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import {
  UserBehavior,
  UserBehaviorSchema,
} from './schemas/user-behavior.schema';
import { Cart, CartSchema } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  AdCampaign,
  AdCampaignSchema,
} from 'src/modules/marketing/campaigns/schemas/ad-campaign.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Coupon,
  CouponSchema,
} from 'src/modules/marketing/promotions/schemas/coupon.schema';
import {
  LoyaltyHistory,
  LoyaltyHistorySchema,
} from 'src/modules/marketing/loyalty/schemas/loyalty-history.schema';

import { LoyaltyFraudListener } from './listeners/loyalty-fraud.listener';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserBehavior.name, schema: UserBehaviorSchema },
      { name: Cart.name, schema: CartSchema },
      { name: AdCampaign.name, schema: AdCampaignSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: LoyaltyHistory.name, schema: LoyaltyHistorySchema },
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => UsersModule),
    NotificationsModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, LoyaltyFraudListener],
  exports: [TrackingService],
})
export class TrackingModule {}
