import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdministrativeUnitDocument = AdministrativeUnit & Document;

// Định nghĩa Enum để phân loại cấp bậc
export enum UnitType {
  PROVINCE = 'PROVINCE',
  DISTRICT = 'DISTRICT',
  WARD = 'WARD',
}

@Schema({ timestamps: true, collection: 'administrative_units' })
export class AdministrativeUnit {
  @Prop({ required: true, unique: true, index: true })
  code: string; // Mã GSO chuẩn (VD: "79", "764", "26740")

  @Prop({ required: true })
  name: string; // Tên ngắn (VD: "Gò Vấp")

  @Prop()
  name_with_type: string; // Tên đầy đủ (VD: "Quận Gò Vấp")

  @Prop({ enum: UnitType, required: true })
  type: UnitType;

  @Prop({ index: true })
  parent_code: string; // Mã GSO của cấp trên (Phường -> Quận, Quận -> Tỉnh)

  @Prop({
    type: {
      ghn_id: { type: Number }, // DistrictID của GHN
      ghn_ward_code: { type: String }, // WardCode của GHN
      ghtk_name: { type: String }, // Tên chuẩn GHTK yêu cầu
      viettel_post_id: { type: String },
    },
    _id: false,
  })
  mapping: {
    ghn_id?: number;
    ghn_ward_code?: string;
    ghtk_name?: string;
    viettel_post_id?: string;
  };

  @Prop({ default: true })
  is_active: boolean;
}

export const AdministrativeUnitSchema =
  SchemaFactory.createForClass(AdministrativeUnit);

// Đánh Index để search địa chỉ nhanh (Cho tính năng Autocomplete ở Frontend)
AdministrativeUnitSchema.index({ name: 'text', name_with_type: 'text' });
AdministrativeUnitSchema.index({ parent_code: 1, type: 1 });
