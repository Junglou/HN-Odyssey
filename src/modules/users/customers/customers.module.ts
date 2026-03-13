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

@Module({
  imports: [
    forwardRef(() => UsersModule),

    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    NotificationsModule,
    AuditLogsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
