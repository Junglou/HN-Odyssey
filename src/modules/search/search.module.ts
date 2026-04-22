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
import { AlgoliaService } from './algolia.service';
import {
  Attribute,
  AttributeSchema,
} from '../products/attributes/schemas/attribute.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: SearchHistory.name, schema: SearchHistorySchema },
      { name: Attribute.name, schema: AttributeSchema },
    ]),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 giây (Time to live)
        limit: 10, // Tối đa 10 request
      },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService, AlgoliaService],
  exports: [SearchService, AlgoliaService],
})
export class SearchModule {}
