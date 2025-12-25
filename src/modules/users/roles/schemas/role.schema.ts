import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Resource, Action } from '../../../../common/enums/resource.enum';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export type RoleDocument = Role & Document;

export class Permission {
  @Prop({ required: true, enum: Resource })
  @IsEnum(Resource, { message: 'Resource không hợp lệ' })
  resource: Resource;

  @IsEnum(Action, { each: true, message: 'Action không hợp lệ' })
  @Prop({ type: [String], enum: Action, default: [] })
  actions: Action[];
}

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: true, unique: true })
  name: string; // VD: "Nhân viên kho"

  @Prop({ required: true, unique: true, uppercase: true })
  slug: string; // VD: "STAFF_WAREHOUSE"

  @Prop()
  description: string;

  // AC2: Ma trận phân quyền (Lưu danh sách permission)
  @Prop({ type: [Permission], default: [] })
  permissions: Permission[];

  // AC4: Cờ đánh dấu Role hệ thống (Super Admin) -> Không được xóa/sửa
  @Prop({ default: false })
  is_system: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
