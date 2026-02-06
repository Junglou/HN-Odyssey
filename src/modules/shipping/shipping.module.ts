import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import {
  ShippingConfig,
  ShippingConfigSchema,
} from './schemas/shipping-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShippingConfig.name, schema: ShippingConfigSchema },
    ]),
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
