import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuditLog extends Document {
  @Prop()
  actor_id?: MongooseSchema.Types.ObjectId; // Null nếu chưa login

  @Prop({ required: true })
  action: string; // "FORGOT_PASSWORD_REQUEST", "RESET_PASSWORD_SUCCESS"

  @Prop({ required: true })
  collection_name: string; // "users"

  @Prop({ type: Object })
  detail: any;

  @Prop()
  ip: string;

  @Prop()
  user_agent: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
