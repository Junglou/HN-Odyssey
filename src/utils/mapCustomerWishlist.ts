import type { Product } from "../types/product";

export interface WishlistItemApiResponse {
  productId?: string;
  variantId?: string | null;
  sku: string;
  has_variants?: boolean;
  name?: string;
  images?: string[];
  price?: number;
  sale_price?: number;
  stock?: number;
  attributes?: unknown[];
  status?: string;
}

const formatAttributes = (attributes?: unknown[]): string => {
  if (!attributes?.length) return "";
  return attributes
    .map((attr) => {
      if (typeof attr === "string") return attr;
      if (attr && typeof attr === "object") {
        const record = attr as Record<string, unknown>;
        const label = record.label ?? record.name ?? record.key;
        const value = record.value;
        if (label != null && value != null) {
          return `${String(label)}: ${String(value)}`;
        }
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
};

export const mapWishlistItemFromApi = (
  item: WishlistItemApiResponse, // <-- Tham số tên là "item"
): Product => {
  const images = item.images ?? [];
  const salePrice = item.sale_price ?? 0;
  const basePrice = item.price ?? 0;
  const displayPrice = salePrice > 0 ? salePrice : basePrice;
  const attributeText = formatAttributes(item.attributes);

  return {
    id: item.productId ? String(item.productId) : "",
    name: item.name ?? "",
    description: attributeText || item.status || "",
    price: displayPrice,
    image: images[0] ?? "",
    variantId: item.variantId ? String(item.variantId) : null,
    sku: item.sku,
    hasVariants: item.has_variants || false,
  };
};
