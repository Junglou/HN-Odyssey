import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DiscountType } from '../../promotions/schemas/coupon.schema';

export type MemberTierDocument = MemberTier & Document;

@Schema({ collection: 'member_tiers', timestamps: true })
export class MemberTier {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string; // VD: SILVER, GOLD, PLATINUM

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  min_spent: number; // Tổng chi tiêu tối thiểu để đạt hạng này

  @Prop({ required: true, default: 1 })
  point_multiplier: number; // X1, X1.5, X2 điểm

  // Ưu đãi tự động sinh ra khi đạt hạng (US.36)
  @Prop({
    type: {
      is_active: { type: Boolean, default: false },
      discount_type: { type: String, enum: DiscountType },
      discount_value: { type: Number, default: 0 },
    },
    _id: false,
  })
  upgrade_reward?: {
    is_active: boolean;
    discount_type: DiscountType;
    discount_value: number;
  };
}
export const MemberTierSchema = SchemaFactory.createForClass(MemberTier);
