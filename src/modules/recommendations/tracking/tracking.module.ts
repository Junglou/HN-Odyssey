import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import {
  UserBehavior,
  UserBehaviorSchema,
} from './schemas/user-behavior.schema';
import { Cart, CartSchema } from 'src/modules/sales/cart/schemas/cart.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserBehavior.name, schema: UserBehaviorSchema },
      { name: Cart.name, schema: CartSchema },
    ]),
    // Bắt buộc khai báo để Cron job quét giỏ hàng hoạt động
    ScheduleModule.forRoot(),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
