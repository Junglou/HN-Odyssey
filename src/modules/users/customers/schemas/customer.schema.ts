import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { User } from '../../schemas/user.schema';

// Sub-document cho địa chỉ (US.10, US.05)
@Schema({ _id: true })
export class Address {
  @Prop() name: string;
  @Prop() phone: string;
  @Prop() street: string;
  @Prop() city_code: string;
  @Prop() district_code: string;
  @Prop() ward_code: string;
  @Prop({ default: false }) is_default: boolean;
}
export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema()
export class Customer extends User {
  // US.35 & US.51: Điểm thưởng & Hạng thành viên
  @Prop({
    type: Object,
    default: { point: 0, tier: 'SILVER', total_spent: 0 },
  })
  loyalty: {
    point: number;
    tier: string;
    total_spent: number;
  };

  // US.05: Sổ địa chỉ
  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];

  // US.02: Wishlist (Yêu thích)
  @Prop([
    {
      product: { type: MongooseSchema.Types.ObjectId, ref: 'Product' },
      variant_id: { type: MongooseSchema.Types.ObjectId, default: null },
      _id: false, // Tắt tự động tạo _id cho các object con này để tối ưu DB
    },
  ])
  wishlist: Array<{
    product: MongooseSchema.Types.ObjectId;
    variant_id: MongooseSchema.Types.ObjectId | null;
  }>;

  // US.117: Ghi chú nội bộ của CSKH về khách này
  @Prop({ type: String, default: '' })
  internal_note: string;

  @Prop({ default: false })
  is_subscribed: boolean;

  @Prop({ default: 'ALLOWED', enum: ['ALLOWED', 'RESTRICTED'] })
  review_access: string; // AC5-AC7: Quản lý quyền đánh giá

  @Prop({ default: '' })
  status_reason: string; // AC4: Lý do thay đổi trạng thái (Bắt buộc)
}

export type CustomerDocument = Customer & Document;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
