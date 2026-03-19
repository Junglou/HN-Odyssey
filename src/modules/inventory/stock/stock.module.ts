import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  StockTransaction,
  StockTransactionSchema,
} from '../transactions/schemas/stock-transaction.schema';
import { StockGateway } from './stock.gateway';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: StockTransaction.name, schema: StockTransactionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [StockController],
  providers: [StockService, StockGateway],
  exports: [StockService, StockGateway],
})
export class StockModule {}
