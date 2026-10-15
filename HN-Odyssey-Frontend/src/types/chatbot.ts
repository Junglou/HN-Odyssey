// Khớp với ChatProductCard ở backend (chat-product-card.service.ts)
export interface ChatCardVariant {
  sku: string;
  price: number;
  original_price: number;
  stock: number;
  image?: string;
  attributes: { code: string; value: string }[];
}

export interface ChatCardOption {
  code: string;
  label: string;
  values: string[];
}

export interface ChatProductCard {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  currency: string;
  price: number;
  original_price: number;
  has_variants: boolean;
  sku?: string;
  stock: number;
  min_qty: number;
  options: ChatCardOption[];
  variants: ChatCardVariant[];
}
