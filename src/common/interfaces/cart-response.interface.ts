import { Types } from 'mongoose';
import { ProductStatus } from '../enums/product-status.enum';

export interface ValidatedCartItem {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  sku: string;
  attributes: any[];
  quantity: number;
  stock: number;
  unitPrice: number;
  originalPrice: number;
  subtotal: number;
  maxPurchase: number;
  isError: boolean;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  shippingFee: number;
  grandTotal: number;
  itemCount: number;
}

export interface CartResponse {
  cartId: string;
  items: ValidatedCartItem[];
  summary: CartSummary;
  warnings: string[];
}

export interface PopulatedCartProduct {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  thumbnail: string;
  status: ProductStatus;
  is_deleted?: boolean;
  max_purchase_qty?: number;
  variants: Array<{
    sku: string;
    stock: number;
    price: number;
    sale_price: number;
    image?: string;
    attributes: any[];
    active: boolean;
  }>;
}
