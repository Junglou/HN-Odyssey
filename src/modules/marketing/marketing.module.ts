import { Module } from '@nestjs/common';
import { PromotionsModule } from './promotions/promotions.module';
import { ContentModule } from './content/content.module';
import { PersonalizationModule } from './personalization/personalization.module';

@Module({
  imports: [PromotionsModule, ContentModule, PersonalizationModule],
  controllers: [],
  providers: [],
  exports: [PromotionsModule, ContentModule, PersonalizationModule],
})
export class MarketingModule {}
