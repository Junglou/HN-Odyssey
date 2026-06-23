import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentConfigDocument = PaymentConfig & Document;

@Schema({ timestamps: true, collection: 'payment_configs' })
export class PaymentConfig {
  @Prop({ required: true, unique: true, enum: ['VNPAY', 'MOMO', 'ZALOPAY'] })
  provider: string; // Tên cổng

  @Prop({ required: true })
  merchant_id: string; // VNP_TMN_CODE hoặc PartnerCode

  @Prop({ required: true })
  secret_key: string; // VNP_HASH_SECRET hoặc SecretKey

  @Prop()
  access_key?: string; // Dành cho Momo/Zalo

  @Prop({
    required: true,
    //default: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  })
  api_endpoint: string; // URL Sandbox hoặc Production

  @Prop()
  return_url: string; // URL redirect về web

  @Prop()
  ipn_url?: string;

  @Prop({ default: true })
  is_active: boolean; // Bật/Tắt cổng này

  @Prop({ default: true })
  is_sandbox: boolean; // Môi trường Test hay Live
}

export const PaymentConfigSchema = SchemaFactory.createForClass(PaymentConfig);
