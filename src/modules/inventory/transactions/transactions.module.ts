import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import {
  StockTransaction,
  StockTransactionSchema,
} from './schemas/stock-transaction.schema';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import { StockModule } from '../stock/stock.module';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { User, UserSchema } from 'src/modules/users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockTransaction.name, schema: StockTransactionSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    StockModule,
    AuditLogsModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
