import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { CategoriesModule } from '../categories/categories.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { TagsModule } from '../tags/tags.module';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Attribute,
  AttributeSchema,
} from '../attributes/schemas/attribute.schema';
import { ProductFilterService } from '../products-filter.service';
import { LoyaltyModule } from 'src/modules/marketing/loyalty/loyalty.module';
import { UsersModule } from 'src/modules/users/users.module';
import {
  MemberTier,
  MemberTierSchema,
} from 'src/modules/marketing/loyalty/schemas/member-tier.schema';
import { MarketingModule } from 'src/modules/marketing/marketing.module';
import { PriceHistorySchema } from './schemas/price-history.schema.ts';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Order.name, schema: OrderSchema },
      { name: Attribute.name, schema: AttributeSchema },
      { name: MemberTier.name, schema: MemberTierSchema },
      {
        name: 'PriceHistory',
        schema: PriceHistorySchema,
      },
    ]),
    CategoriesModule,
    AuditLogsModule,
    TagsModule,
    LoyaltyModule,
    UsersModule,
    MarketingModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductFilterService],
  exports: [ProductsService],
})
export class ProductsCatalogModule {}
