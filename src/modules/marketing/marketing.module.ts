import { Module } from '@nestjs/common';
import { PromotionsModule } from './promotions/promotions.module';

@Module({
  imports: [PromotionsModule],
  controllers: [],
  providers: [],
  exports: [PromotionsModule],
})
export class MarketingModule {}
