import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AdCampaign } from './ad-campaign.schema';

export type AdSpendEntryDocument = AdSpendEntry & Document;

// Ghi chú cố định của dòng sinh ra khi migrate (dùng để migration chạy lại không bị nhân đôi)
export const AD_SPEND_MIGRATION_NOTE = 'Migrated from legacy total';

/**
 * Nhật ký chi phí quảng cáo (US.82 AC1) — mỗi lần phát sinh chi phí là 1 dòng.
 * KHÔNG sửa, KHÔNG xóa: nhập sai thì hủy (void) kèm lý do rồi nhập dòng mới.
 * Tiền: USD. Ngày: 00:00 giờ VN (vnStartOfDay).
 */
@Schema({ collection: 'ad_spend_entries', timestamps: true })
export class AdSpendEntry {
  @Prop({ type: Types.ObjectId, ref: AdCampaign.name, required: true })
  campaign_id: Types.ObjectId;

  // USD, > 0, tối đa 2 chữ số thập phân (DTO kiểm tra số lẻ)
  @Prop({ required: true, min: 0.01, max: 1_000_000_000 })
  amount: number;

  // 00:00 giờ VN của ngày bắt đầu
  @Prop({ required: true, type: Date })
  period_start: Date;

  // 00:00 giờ VN của ngày kết thúc (= period_start nếu chi phí của 1 ngày)
  @Prop({ required: true, type: Date })
  period_end: Date;

  @Prop({ type: String, trim: true, maxlength: 500 })
  note?: string;

  // null = hệ thống tạo (migration)
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  created_by: Types.ObjectId | null;

  @Prop({ default: false })
  is_voided: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  voided_by: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  voided_at: Date | null;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  void_reason: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AdSpendEntrySchema = SchemaFactory.createForClass(AdSpendEntry);

// Báo cáo: lấy các dòng chưa hủy giao với kỳ lọc (mục 3.2)
AdSpendEntrySchema.index({
  campaign_id: 1,
  is_voided: 1,
  period_start: 1,
  period_end: 1,
});

// Màn nhật ký: danh sách dòng của 1 chiến dịch, mới nhất trước
AdSpendEntrySchema.index({ campaign_id: 1, createdAt: -1 });
