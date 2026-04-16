import { Module } from '@nestjs/common';
import { ProductsCatalogModule } from './catalog/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { TagsModule } from './tags/tags.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoriesModule } from './categories/categories.module';
import { ComparisonModule } from './comparison/comparison.module';

@Module({
  imports: [
    AttributesModule,
    TagsModule,
    ProductsCatalogModule,
    ReviewsModule,
    CategoriesModule,
    ComparisonModule,
  ],
  exports: [
    ProductsCatalogModule,
    AttributesModule,
    TagsModule,
    ComparisonModule,
    ReviewsModule,
  ],
})
export class ProductsModule {}
