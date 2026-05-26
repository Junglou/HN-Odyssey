import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';
import { WarrantyListener } from './warranty.listener';

// Import các Schema đã định nghĩa trong file schemas/warranty-claim.schema.ts
import {
  WarrantyItem,
  WarrantyItemSchema,
  WarrantyClaim,
  WarrantyClaimSchema,
} from './schemas/warranty-claim.schema';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WarrantyItem.name, schema: WarrantyItemSchema },
      { name: WarrantyClaim.name, schema: WarrantyClaimSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [WarrantyController],
  providers: [WarrantyService, WarrantyListener],
  exports: [WarrantyService],
})
export class WarrantyModule {}
