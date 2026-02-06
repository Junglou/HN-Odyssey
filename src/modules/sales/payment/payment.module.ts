import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { VnpayService } from './providers/vnpay.service';
import { StockModule } from 'src/modules/inventory/stock/stock.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    StockModule,
    NotificationsModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, VnpayService],
  exports: [VnpayService],
})
export class PaymentModule {}
