import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromotionEngineService } from './promotion-engine.service';
import { CouponsService } from './coupons.service';
import { FlashSalesService } from './flash-sales.service';
import { Combo, ComboSchema } from './schemas/combo.schema';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { FlashSale, FlashSaleSchema } from './schemas/flash-sale.schema';
import { PromotionsController } from './promotions.controller';
import { RolesModule } from 'src/modules/users/roles/roles.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { ScheduleModule } from '@nestjs/schedule';
import {
  Product,
  ProductSchema,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Combo.name, schema: ComboSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: FlashSale.name, schema: FlashSaleSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    ScheduleModule.forRoot(),
    RolesModule,
    AuditLogsModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionEngineService, CouponsService, FlashSalesService],
  exports: [PromotionEngineService],
})
export class PromotionsModule {}
