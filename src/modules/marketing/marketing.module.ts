import { Module } from '@nestjs/common';
import { PromotionsModule } from './promotions/promotions.module';
import { ContentModule } from './content/content.module';

@Module({
  imports: [PromotionsModule, ContentModule],
  controllers: [],
  providers: [],
  exports: [PromotionsModule, ContentModule],
})
export class MarketingModule {}
