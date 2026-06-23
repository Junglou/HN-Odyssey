import { Types } from 'mongoose';

// 1. Interface cho Query params của findAll
export interface ProductQueryParam {
  page?: string | number;
  limit?: string | number;
  keyword?: string;
  category_id?: string;
  status?: string;
  sort?: string;
  [key: string]: any; // Cho phép các field khác nếu có
}

// 2. Interface cho Variant Input
export interface VariantInput {
  sku?: string;
  price?: number;
  attributes?: {
    code: string;
    value: string;
    unit?: string;
  }[];
}

// 3. Interface cho cấu trúc Attribute trong Schema
export interface ProductAttribute {
  code: string;
  value: string;
  unit?: string;
}

// 4. Interface rút gọn cho Category
export interface CategorySimple {
  _id: Types.ObjectId | string;
  name: string;
  slug: string;
  parent_id?: Types.ObjectId | string | null;
}
