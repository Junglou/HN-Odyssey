import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdCampaignDocument = AdCampaign & Document;

@Schema({ collection: 'ad_campaigns', timestamps: true })
export class AdCampaign {
  @Prop({ required: true, unique: true, index: true })
  name: string;

  @Prop({ required: true, index: true })
  utm_campaign: string;

  @Prop()
  utm_source?: string;

  @Prop()
  utm_medium?: string;

  // Tiền chi phí quảng cáo (Ad Spend) nhập tay (US: ROI - AC1)
  @Prop({ required: true, default: 0, min: 0 })
  ad_spend: number;

  @Prop({ required: true, type: Date })
  start_date: Date;

  @Prop({ type: Date })
  end_date?: Date;

  @Prop({ default: 'ACTIVE', enum: ['ACTIVE', 'PAUSED', 'COMPLETED'] })
  status: string;

  @Prop({ required: false, default: 0 })
  budget?: number;
}

export const AdCampaignSchema = SchemaFactory.createForClass(AdCampaign);
