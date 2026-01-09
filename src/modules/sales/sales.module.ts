import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [CartModule, OrdersModule],
  controllers: [],
  providers: [],
  exports: [CartModule, OrdersModule],
})
export class SalesModule {}
