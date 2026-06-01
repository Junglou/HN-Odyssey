export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  /** Present on wishlist items from API */
  variantId?: string | null;
}
