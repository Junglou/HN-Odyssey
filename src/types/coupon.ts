export interface Coupon {
  // Thông tin cơ bản
  id: string;
  name: string;
  description: string;
  image: string;

  discountType: "percentage" | "fixed";
  discountValue: number;

  startDate: string;
  endDate: string;
  isActive: boolean;

  minimumPurchase: number;
  couponCode: string;
}
