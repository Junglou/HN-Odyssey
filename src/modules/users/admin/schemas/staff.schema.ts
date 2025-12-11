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

  @Prop({ type: Date })
  last_login_at: Date; // Để theo dõi hoạt động nhân viên
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
