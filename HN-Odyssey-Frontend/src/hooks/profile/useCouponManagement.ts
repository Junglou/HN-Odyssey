import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import tokenStorage from "../../utils/tokenStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = tokenStorage.getToken();
  return {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  };
};

/** Display status for profile coupon cards */
export type CustomerCouponStatus =
  | "Active"
  | "Inactive"
  | "Scheduled"
  | "Expired"
  | "Draft";

export type CustomerDiscountType = "Percentage" | "Fixed Amount";

export interface CustomerCoupon {
  id: string;
  code: string;
  description: string;
  discountType: CustomerDiscountType;
  discountValue: string;
  usedCount: number;
  totalUses: number;
  perCustomerLimit?: number;
  status: CustomerCouponStatus;
  startDate: string;
  endDate: string;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
}

type CouponApiStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | "CANCELLED";
type CouponApiDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

interface CouponApiItem {
  _id?: string;
  code?: string;
  description?: string;
  discount_type?: CouponApiDiscountType;
  discount_value?: number;
  min_order_value?: number;
  max_discount_amount?: number;
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  usage_count?: number;
  user_usage_limit?: number;
  status?: CouponApiStatus;
  owner_id?: string;
}

interface VoucherSuggestionApi {
  coupon?: CouponApiItem;
}

const formatDate = (isoString?: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const mapDiscountType = (type?: CouponApiDiscountType): CustomerDiscountType =>
  type === "PERCENTAGE" ? "Percentage" : "Fixed Amount";

const formatDiscountValue = (
  type?: CouponApiDiscountType,
  value?: number,
): string => {
  const num = value ?? 0;
  return type === "PERCENTAGE"
    ? `${num}%`
    : `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
};

const mapStatus = (coupon: CouponApiItem): CustomerCouponStatus => {
  const now = Date.now();
  const start = coupon.start_date ? new Date(coupon.start_date).getTime() : 0;
  const end = coupon.end_date ? new Date(coupon.end_date).getTime() : 0;

  if (coupon.status === "DRAFT") return "Draft";
  if (coupon.status === "CANCELLED") return "Expired";
  if (coupon.status === "INACTIVE") return "Inactive";
  if (start > now) return "Scheduled";
  if (end > 0 && end < now) return "Expired";
  return "Active";
};

const mapCouponFromApi = (item: CouponApiItem): CustomerCoupon => ({
  id: item._id ? String(item._id) : "",
  code: item.code ?? "",
  description: item.description ?? "",
  discountType: mapDiscountType(item.discount_type),
  discountValue: formatDiscountValue(item.discount_type, item.discount_value),
  usedCount: item.usage_count ?? 0,
  totalUses: item.usage_limit ?? 0,
  perCustomerLimit: item.user_usage_limit,
  status: mapStatus(item),
  startDate: formatDate(item.start_date),
  endDate: formatDate(item.end_date),
  minimumOrderValue: item.min_order_value,
  maximumDiscountAmount: item.max_discount_amount,
});

export function useCouponManagement() {
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/personalization/vouchers`, {
        ...getAuthHeaders(),
        params: { context: "HOME" },
      });

      const payload = res.data;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const rawCoupons = (list as VoucherSuggestionApi[])
        .map((entry) => entry.coupon ?? (entry as unknown as CouponApiItem))
        .filter((c): c is CouponApiItem => !!c && !!c._id);

      const mapped = rawCoupons.map(mapCouponFromApi);
      setCoupons(mapped);
    } catch (err: unknown) {
      console.error("Không thể tải danh sách mã giảm giá:", err);
      if (axios.isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          "Lỗi khi tải mã giảm giá";
        toast.error(msg);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error("Không thể tải danh sách mã giảm giá.");
      }
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  return {
    coupons,
    loading,
    refresh: fetchCoupons,
  };
}
