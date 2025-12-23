import { Module } from '@nestjs/common';
import { ProductsCatalogModule } from './catalog/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [
    AttributesModule,
    TagsModule,
    ProductsCatalogModule,
    // ReviewsModule,
  ],
  exports: [ProductsCatalogModule, AttributesModule, TagsModule],
})
export class ProductsModule {}
