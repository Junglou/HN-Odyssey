import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { PdfService } from './pdf.service';
import { OrdersCronService } from './orders.cron';
import { JwtModule } from '@nestjs/jwt';
import { StockModule } from 'src/modules/inventory/stock/stock.module';
import { MarketingModule } from 'src/modules/marketing/marketing.module';
import { PaymentModule } from '../payment/payment.module';
import {
  ShippingConfig,
  ShippingConfigSchema,
} from 'src/modules/shipping/schemas/shipping-config.schema';
import { ShippingModule } from 'src/modules/shipping/shipping.module';
import { OrderStateMachine } from './flow/order-state-machine.service';
import { OrderShippingListener } from './listeners/order-shipping.listener';
import {
  FlashSale,
  FlashSaleSchema,
} from 'src/modules/marketing/promotions/schemas/flash-sale.schema';
import { LoyaltyModule } from 'src/modules/marketing/loyalty/loyalty.module';
import { CommandModule } from 'nestjs-command';
import { OrderSeederCommand } from './SeedOrder/order-seeder.command';
import { OrderSeederService } from './SeedOrder/order-seeder.service';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
      { name: ShippingConfig.name, schema: ShippingConfigSchema },
      { name: FlashSale.name, schema: FlashSaleSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
    MarketingModule,
    StockModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => ShippingModule),
    JwtModule.register({}),
    LoyaltyModule,
    CommandModule,
    forwardRef(() => CartModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PdfService,
    OrdersCronService,
    OrderStateMachine,
    OrderShippingListener,
    OrderSeederService,
    OrderSeederCommand,
  ],
  exports: [OrdersService, PdfService],
})
export class OrdersModule {}
