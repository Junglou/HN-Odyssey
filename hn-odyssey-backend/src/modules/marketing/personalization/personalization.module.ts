import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { PersonalizationController } from './personalization.controller';
import { PersonalizedMarketingService } from './personalized-marketing.service';
import { Coupon, CouponSchema } from '../promotions/schemas/coupon.schema';
import { Banner, BannerSchema } from '../content/schemas/banner.schema';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import { Cart, CartSchema } from 'src/modules/sales/cart/schemas/cart.schema';
import {
  UserBehavior,
  UserBehaviorSchema,
} from 'src/modules/recommendations/tracking/schemas/user-behavior.schema';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { RecommendationsModule } from 'src/modules/recommendations/recommendations.module';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: Banner.name, schema: BannerSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: UserBehavior.name, schema: UserBehaviorSchema },
    ]),
    // Để kích hoạt các tác vụ chạy ngầm như Gửi Email Win-back lúc 9h sáng
    ScheduleModule.forRoot(),
    PromotionsModule,
    NotificationsModule,
    RecommendationsModule,
    UsersModule,
  ],
  controllers: [PersonalizationController],
  providers: [PersonalizedMarketingService],
  exports: [PersonalizedMarketingService],
})
export class PersonalizationModule {}
