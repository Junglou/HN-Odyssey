import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  Category,
  CategorySchema,
} from 'src/modules/products/categories/schemas/category.schema';
import {
  IntegrationLog,
  IntegrationLogSchema,
} from 'src/modules/system/monitoring/schemas/integration-log.schema';
import {
  SystemMetric,
  SystemMetricSchema,
} from 'src/modules/system/monitoring/schemas/system-metric.schema';
import {
  WarrantyClaim,
  WarrantyClaimSchema,
} from 'src/modules/support/warranty/schemas/warranty-claim.schema';
import { ConversationSchema } from 'src/modules/support/chat/schemas/conversation.schema';
import { Conversation } from 'twilio/lib/twiml/VoiceResponse';
import {
  StockTransaction,
  StockTransactionSchema,
} from 'src/modules/inventory/transactions/schemas/stock-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: WarrantyClaim.name, schema: WarrantyClaimSchema },
      { name: SystemMetric.name, schema: SystemMetricSchema },
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
      { name: StockTransaction.name, schema: StockTransactionSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
