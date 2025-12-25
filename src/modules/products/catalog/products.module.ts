import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { CategoriesModule } from '../categories/categories.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { TagsModule } from '../tags/tags.module';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    // [TODO] Sẽ mở comment khi Module Order hoàn thành
    // forwardRef(() => OrdersModule),
    CategoriesModule,
    AuditLogsModule,
    TagsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsCatalogModule {}
