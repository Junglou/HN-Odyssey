import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Address {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  province: string;

  @Prop({ required: true })
  district: string;

  @Prop({ required: true })
  ward: string;

  @Prop({ required: true })
  address: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: String, enum: ['HOME', 'OFFICE'], default: 'HOME' })
  type: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
