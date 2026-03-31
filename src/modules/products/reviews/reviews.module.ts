import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import {
  ReviewReport,
  ReviewReportSchema,
} from './schemas/review-report.schema';
import { ReviewEventListener } from './review.listener';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: ReviewReport.name, schema: ReviewReportSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewEventListener],
})
export class ReviewsModule {}
