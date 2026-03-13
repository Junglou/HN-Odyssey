import { forwardRef, Module } from '@nestjs/common';
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
import {
  PaymentConfig,
  PaymentConfigSchema,
} from './schemas/payment-config.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema';
import { UsersModule } from 'src/modules/users/users.module';
import { MomoService } from './providers/momo.service';
import { CodService } from './providers/cod.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: PaymentConfig.name, schema: PaymentConfigSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
    forwardRef(() => OrdersModule),
    StockModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, VnpayService, MomoService, CodService],
  exports: [VnpayService, MomoService, CodService, PaymentService],
})
export class PaymentModule {}
