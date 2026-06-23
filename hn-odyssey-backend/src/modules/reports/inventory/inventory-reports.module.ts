import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryReportsController } from './inventory-reports.controller';
import { InventoryReportsService } from './inventory-reports.service';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  StockTransaction,
  StockTransactionSchema,
} from 'src/modules/inventory/transactions/schemas/stock-transaction.schema';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: StockTransaction.name, schema: StockTransactionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [InventoryReportsController],
  providers: [InventoryReportsService],
})
export class InventoryReportsModule {}
