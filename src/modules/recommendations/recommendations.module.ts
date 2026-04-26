import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationsController } from './recommendations.controller';
import { AssociationRuleService } from './engine/association-rule.service';
import { ContextualCartService } from './engine/contextual-cart.service';
import { PersonalizedService } from './engine/personalized.service';
import { BundleDiscountService } from './engine/bundle-discount.service';
import { MlIntegrationService } from './engine/ml-integration.service';
import { TrackingModule } from 'src/modules/recommendations/tracking/tracking.module';
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

@Module({
  imports: [
    ScheduleModule.forRoot(), // Kích hoạt Cronjob
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: UserBehavior.name, schema: UserBehaviorSchema },
    ]),
    TrackingModule,
  ],
  controllers: [RecommendationsController],
  providers: [
    AssociationRuleService,
    ContextualCartService,
    PersonalizedService,
    BundleDiscountService,
    MlIntegrationService,
  ],
  exports: [AssociationRuleService, ContextualCartService, PersonalizedService],
})
export class RecommendationsModule {}
