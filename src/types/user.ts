import type { Product } from "./product";
import type { Coupon } from "./coupon";

// UserProfile
export interface UserProfile {
  id: string;
  avatar: string; 
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  birthday: string; // DD/MM/YYYY
  displayName: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  amountSpent: number;
  userAddresses: UserAddress[];
  userOrders: UserOrder[];
  userFinishedOrders: UserOrder[];
  userWishlist: Product[];
  userCoupons: Coupon[];
}

export interface ProductRecommendation {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

export interface UserAddress {
  receiverName: string;
  address: string;
  city: string;
  country: string;
}

export interface UserOrder {
  address: UserAddress;
  product: Product[];
  orderDate: string;
  shipDate: string;
  shipFee: string;
  status: string;
}
