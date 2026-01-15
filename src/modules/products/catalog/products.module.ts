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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Order.name, schema: OrderSchema },
      { name: Attribute.name, schema: AttributeSchema },
    ]),
    CategoriesModule,
    AuditLogsModule,
    TagsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductFilterService],
  exports: [ProductsService],
})
export class ProductsCatalogModule {}
