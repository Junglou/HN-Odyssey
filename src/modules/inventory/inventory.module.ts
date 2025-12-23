import { Module } from '@nestjs/common';
import { StockModule } from './stock/stock.module';
// Import thêm TransactionModule, AlertsModule... sau này tại đây

@Module({
  imports: [StockModule],
  controllers: [],
  providers: [],
  exports: [StockModule],
})
export class InventoryModule {}
