import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeInController } from './trade-in.controller';
import { TradeInService } from './trade-in.service';
import {
  TradeInRequest,
  TradeInRequestSchema,
} from './schemas/trade-in-request.schema';
import {
  Category,
  CategorySchema,
} from '../products/categories/schemas/category.schema';
import { ProductSchema } from '../products/catalog/schemas/product.schema';
import { OrderSchema } from '../sales/orders/schemas/order.schema';
import {
  TradeInPriceList,
  TradeInPriceListSchema,
} from './schemas/trade-in-price-list.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradeInRequest.name, schema: TradeInRequestSchema },
      { name: TradeInPriceList.name, schema: TradeInPriceListSchema },
      { name: Category.name, schema: CategorySchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Order', schema: OrderSchema },
    ]),
  ],
  controllers: [TradeInController],
  providers: [TradeInService],
  exports: [TradeInService],
})
export class TradeInModule {}
