import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SearchHistoryDocument = SearchHistory & Document;

@Schema({ timestamps: true })
export class SearchHistory {
  @Prop({ required: true, index: true })
  keyword: string;

  @Prop({ index: true }) // Index để query theo user nhanh
  user_id?: string;

  @Prop()
  device_id?: string; // AC1: Dùng cho khách vãng lai

  @Prop({ default: 1 })
  count: number; // Đếm số lần tìm (để tính Trending cho AC1)

  @Prop()
  last_searched_at: Date;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);
