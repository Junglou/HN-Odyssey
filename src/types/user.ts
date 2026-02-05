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
