import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose'; // Fix import

export type ShippingConfigDocument = HydratedDocument<ShippingConfig>;

@Schema({ _id: false }) // Sub-document cho Fees
export class ShippingFees {
  @Prop() inner_city: number;
  @Prop() outer_city: number;
  @Prop() other_province: number;
  @Prop() instant_surcharge: number;
  @Prop() bulky_surcharge: number;
  @Prop() max_weight_instant: number;
  @Prop() max_weight_standard: number;
}

@Schema({ collection: 'shipping_configs' })
export class ShippingConfig extends Document {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Object })
  inner_districts: Record<string, string[]>;

  @Prop({ type: ShippingFees })
  fees: ShippingFees;

  @Prop({ default: 'GHN' })
  default_provider: string;

  @Prop({ type: Object })
  ghn_config: { token: string; shop_id: number; is_active: boolean };

  @Prop({ type: Object })
  ghtk_config: { token: string; is_active: boolean };
}

export const ShippingConfigSchema =
  SchemaFactory.createForClass(ShippingConfig);
