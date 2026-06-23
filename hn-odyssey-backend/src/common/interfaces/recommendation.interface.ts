import { Types } from 'mongoose';
import { ProductDocument } from 'src/modules/products/catalog/schemas/product.schema';

export interface IConfidenceScore {
  product_id: Types.ObjectId;
  confidence: number;
  freq: number;
}

export interface IFBTRecommendation {
  product: ProductDocument;
  confidence: number;
  reason: string; // AC21: Hiển thị lý do
}

export interface IRecommendationFeedback {
  session_id: string;
  user_id?: string;
  recommended_product_id: string;
  widget_type: 'FBT' | 'CART' | 'HOME' | 'CATEGORY';
  action: 'CLICK' | 'VIEW' | 'IGNORE' | 'ADD_TO_CART';
}
