import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyCronService } from './loyalty.cron';
import { MemberTier, MemberTierSchema } from './schemas/member-tier.schema';
import {
  LoyaltyHistory,
  LoyaltyHistorySchema,
} from './schemas/loyalty-history.schema';
import { Coupon, CouponSchema } from '../promotions/schemas/coupon.schema';
import { UsersModule } from 'src/modules/users/users.module';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: MemberTier.name, schema: MemberTierSchema },
      { name: LoyaltyHistory.name, schema: LoyaltyHistorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    ScheduleModule.forRoot(),
    UsersModule,
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyCronService],
  exports: [LoyaltyService, LoyaltyCronService, MongooseModule],
})
export class LoyaltyModule {}
