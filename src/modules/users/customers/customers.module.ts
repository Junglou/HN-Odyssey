import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import {
  Order,
  OrderSchema,
} from 'src/modules/sales/orders/schemas/order.schema';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { UsersModule } from '../users.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';
import { CustomersAdminService } from './admin-customer.service';
import { CustomersAdminController } from './admin-customer.controller';
import {
  Review,
  ReviewSchema,
} from 'src/modules/products/reviews/schemas/review.schema';
import {
  AuditLog,
  AuditLogSchema,
} from 'src/modules/system/audit-logs/schemas/audit-log.schema';

@Module({
  imports: [
    forwardRef(() => UsersModule),

    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    NotificationsModule,
    AuditLogsModule,
  ],
  controllers: [CustomersController, CustomersAdminController],
  providers: [CustomersService, CustomersAdminService],
  exports: [CustomersService, CustomersAdminService],
})
export class CustomersModule {}
