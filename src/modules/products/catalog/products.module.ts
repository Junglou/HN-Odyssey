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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    CategoriesModule,
    AuditLogsModule,
    TagsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsCatalogModule {}
