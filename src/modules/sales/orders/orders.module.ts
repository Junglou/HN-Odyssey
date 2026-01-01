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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Cart.name, schema: CartSchema },
    ]),
    AuditLogsModule, 
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
