import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { User } from '../../schemas/user.schema';

// Sub-document cho địa chỉ (US.10)
@Schema({ _id: true })
export class Address {
  @Prop() name: string;
  @Prop() phone: string;
  @Prop() street: string;
  @Prop() city_code: string;
  @Prop() district_code: string;
  @Prop({ default: false }) is_default: boolean;
}
const AddressSchema = SchemaFactory.createForClass(Address);

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

  // US.10: Sổ địa chỉ
  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];

  // Wishlist (Yêu thích)
  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }])
  wishlist: MongooseSchema.Types.ObjectId[];

  // US.117: Ghi chú nội bộ của CSKH về khách này
  @Prop({ type: String })
  internal_note: string;

  // Thêm vào trong class User
  @Prop({ default: false })
  is_subscribed: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
