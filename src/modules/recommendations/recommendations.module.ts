import { Module } from '@nestjs/common';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [TrackingModule],
  controllers: [],
  providers: [],
  exports: [TrackingModule],
})
export class RecommendationModule {}
