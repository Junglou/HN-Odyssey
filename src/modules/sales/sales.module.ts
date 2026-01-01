import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { Cart, CartSchema } from './cart/schemas/cart.schema';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import {
  Product,
  ProductSchema,
} from '../products/catalog/schemas/product.schema';
import { Order, OrderSchema } from './orders/schemas/order.schema';
import { AuditLogsModule } from '../system/audit-logs/audit-logs.module';
import { OrdersCronService } from './orders/orders.cron';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    AuditLogsModule,
    JwtModule.register({}),
  ],
  controllers: [CartController, OrdersController],
  providers: [CartService, OrdersService, OrdersCronService],
})
export class SalesModule {}
