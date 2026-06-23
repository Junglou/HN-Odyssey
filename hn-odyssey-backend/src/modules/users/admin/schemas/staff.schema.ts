import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { User } from '../../schemas/user.schema';

@Schema()
export class Staff extends User {
  @Prop({ required: true, unique: true })
  employee_code: string; // Mã nhân viên

  @Prop({ required: true })
  department: string; // VD: "Warehouse", "Accounting", "CS"

  // Phân quyền chi tiết (RBAC)
  @Prop([String])
  permissions: string[]; // VD: ['MANAGE_ORDER', 'VIEW_REPORT', 'APPROVE_RETURN']
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
