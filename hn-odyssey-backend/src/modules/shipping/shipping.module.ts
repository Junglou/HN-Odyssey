import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import {
  ShippingConfig,
  ShippingConfigSchema,
} from './schemas/shipping-config.schema';
import { OrdersModule } from '../sales/orders/orders.module';
import { GhnService } from './providers/ghn.service';
import { GhtkService } from './providers/ghtk.service';
import {
  AdministrativeUnit,
  AdministrativeUnitSchema,
} from './schemas/administrative-unit.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShippingConfig.name, schema: ShippingConfigSchema },
      { name: AdministrativeUnit.name, schema: AdministrativeUnitSchema },
    ]),
    forwardRef(() => OrdersModule),
  ],
  controllers: [ShippingController],
  providers: [ShippingService, GhnService, GhtkService],
  exports: [ShippingService, GhnService, GhtkService],
})
export class ShippingModule {}
