import { Module } from '@nestjs/common';
import { StockModule } from './stock/stock.module';
import { TransactionsModule } from './transactions/transactions.module';
// Import thêm TransactionModule, AlertsModule... sau này tại đây

@Module({
  imports: [StockModule, TransactionsModule],
  controllers: [],
  providers: [],
  exports: [StockModule, TransactionsModule],
})
export class InventoryModule {}
