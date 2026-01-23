import { Module } from '@nestjs/common';
import { ProductsCatalogModule } from './catalog/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { TagsModule } from './tags/tags.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    AttributesModule,
    TagsModule,
    ProductsCatalogModule,
    ReviewsModule,
    CategoriesModule,
  ],
  exports: [ProductsCatalogModule, AttributesModule, TagsModule],
})
export class ProductsModule {}
