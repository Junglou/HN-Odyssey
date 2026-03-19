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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: StockTransaction.name, schema: StockTransactionSchema },
    ]),
  ],
  controllers: [StockController],
  providers: [StockService, StockGateway],
  exports: [StockService],
})
export class StockModule {}
