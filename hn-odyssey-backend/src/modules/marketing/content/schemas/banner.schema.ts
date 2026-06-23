import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum BannerStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Banner extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  // AC5: URL Link
  @Prop({ required: true, trim: true })
  link: string;

  @Prop({ required: true })
  position: string;

  // AC7: Responsive
  @Prop({ required: true })
  image_pc: string;

  @Prop({ required: true })
  image_mobile: string;

  // AC2: Lịch hiển thị
  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  // AC3: Gán banner theo ngữ cảnh danh mục
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null })
  category_id?: Types.ObjectId;

  // AC4: Sắp xếp thứ tự
  @Prop({ default: 0 })
  display_order: number;

  @Prop({ required: true, enum: BannerStatus, default: BannerStatus.WAITING })
  status: BannerStatus;

  // AC8: Đo lường CTR
  @Prop({ default: 0 })
  clicks: number;

  @Prop({ default: 0 })
  impressions: number;

  // AC9: Lưu người tạo
  @Prop({ default: 'Admin' })
  created_by: string;

  // AC6: Soft Delete
  @Prop({ default: false, index: true })
  is_deleted: boolean;

  @Prop({ default: null })
  deleted_at: Date;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

// Virtual CTR (Click-Through Rate)
BannerSchema.virtual('ctr').get(function (this: Banner) {
  if (this.impressions === 0) return 0;
  return Number(((this.clicks / this.impressions) * 100).toFixed(2));
});

BannerSchema.set('toJSON', { virtuals: true });
BannerSchema.set('toObject', { virtuals: true });
BannerSchema.index({ position: 1, status: 1, is_deleted: 1 });
