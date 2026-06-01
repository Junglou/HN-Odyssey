export type CouponStatus =
  | "Active"
  | "Inactive"
  | "Scheduled"
  | "Expired"
  | "Draft";
export type DiscountType = "Percentage" | "Fixed Amount";

export interface ApplicableScopeObj {
  isAllProducts: boolean;
  categories: string[];
  tags: string[];
  products: string[];
}

export interface CouponRecord {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  usedCount: number;
  totalUses: number;
  perCustomerLimit?: number;
  status: CouponStatus;
  startDate: string;
  endDate: string;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  applicableScope: ApplicableScopeObj;
}

export interface CouponFormData {
  code: string;
  discountType: DiscountType;
  discountValueNum: string;
  minimumOrderValueNum: string;
  maximumDiscountAmountNum: string;
  totalUsesNum: string;
  perCustomerLimitNum: string;
  startDate: string;
  endDate: string;
  applicableScope: ApplicableScopeObj;
  isDraft: boolean;
}
