import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromotionEngineService } from './promotion-engine.service';
import { Combo, ComboSchema } from './schemas/combo.schema';
import { PromotionsController } from './promotions.controller';
import { RolesModule } from 'src/modules/users/roles/roles.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Combo.name, schema: ComboSchema }]),
    RolesModule,
    AuditLogsModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionEngineService],
  exports: [PromotionEngineService],
})
export class PromotionsModule {}
