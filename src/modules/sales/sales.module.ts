import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [CartModule, OrdersModule, PaymentModule],
  controllers: [],
  providers: [],
  exports: [CartModule, OrdersModule],
})
export class SalesModule {}
