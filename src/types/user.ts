// UserProfile
export interface UserProfile {
  avatar: string;
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  birthday: string; // DD/MM/YYYY
  displayName: string;
  username: string;
  email: string;
  phone: string;
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
  product: ProductRecommendation[];
  orderDate: String;
  shipDate: String;
  shipFee: String;
  status: string;
}
