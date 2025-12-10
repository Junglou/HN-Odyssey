import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';

@Schema({ _id: false })
class SocialAuth {
  @Prop({ name: 'google_id' })
  googleId: string;
  @Prop({ name: 'facebook_id' })
  facebookId: string;
}

const SocialAuthSchema = SchemaFactory.createForClass(SocialAuth);

@Schema({ _id: false })
class Loyalty {
  @Prop({ default: 0 })
  point: number;

  @Prop({ default: 0 })
  tier: number;

  @Prop({ name: 'total_spent', default: 0 })
  totalSpent: number;
}

const LoyaltySchema = SchemaFactory.createForClass(Loyalty);

export type UserDocument = User & Document;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'users',
})
export class User {
  @Prop({ name: 'full_name', required: true })
  fullName: string;

  @Prop({ required: true, unique: true, trim: true })
  email: string;

  @Prop({ name: 'phone', unique: true, sparse: true })
  phoneNumber: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ default: null })
  avatar?: string | null;

  @Prop({ enum: ['MALE', 'FEMALE', 'OTHER'], default: 'OTHER' })
  gender?: string;

  @Prop({ name: 'date_of_birth', type: Date })
  dateOfBirth?: Date;

  @Prop({ required: true, default: ['CUSTOMER'] })
  roles: string[];

  @Prop({
    default: ['PENDING'],
    enum: ['PENDING', 'ACTIVE', 'LOCKED', 'BANNED'],
  })
  status: string;

  @Prop({ name: 'is_active', default: false })
  isActive: boolean;

  @Prop({ name: 'social_auth', type: SocialAuthSchema, default: {} })
  socialAuth: SocialAuth;

  @Prop({ name: 'login_attempts', default: 0 })
  loginAttempts: number;

  @Prop({ name: 'lock_until', type: Date })
  lockUntil?: Date;

  @Prop({ name: 'verify_token', select: false })
  verifyToken?: string;

  @Prop({ name: 'verify_token_expires', type: Date })
  verifyTokenExpires?: Date;

  @Prop({ name: 'last_login_at', type: Date })
  lastLoginAt?: Date;

  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];

  @Prop({ type: LoyaltySchema, default: () => ({}) })
  loyalty: Loyalty;

  @Prop({ name: 'deleted_at', type: Date, default: null })
  deletedAt?: Date;

  @Prop({ name: 'internal_note' })
  internalNote?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexing
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ full_name: 'text', email: 'text', phone: 'text' });
UserSchema.index({ 'social_auth.google_id': 1 });
UserSchema.index({ 'social_auth.facebook_id': 1 });
