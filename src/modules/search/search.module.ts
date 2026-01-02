import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import {
  Product,
  ProductSchema,
} from '../products/catalog/schemas/product.schema';
import {
  SearchHistory,
  SearchHistorySchema,
} from './schemas/search-history.schema';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: SearchHistory.name, schema: SearchHistorySchema },
    ]),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 giây (Time to live)
        limit: 10, // Tối đa 10 request
      },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
