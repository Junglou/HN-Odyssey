import { Module } from '@nestjs/common';
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
import { PromotionsModule } from 'src/modules/marketing/promotions/promotions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
    PromotionsModule,
    JwtModule.register({}),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PdfService, OrdersCronService],
  exports: [OrdersService],
})
export class OrdersModule {}
