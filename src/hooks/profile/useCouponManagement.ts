import { useState, useEffect } from "react";
import type { Coupon } from "../../types/coupon";
import { INITIAL_MOCK_USERS } from "./userData";

export function useCouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng gọi API để lấy đơn hàng của người dùng
    const fetchCoupons = async () => {
      try {
        const userCoupons = INITIAL_MOCK_USERS.userCoupons || [];
        setCoupons(userCoupons);
      } catch (error) {
        console.error("Không thể tải phiếu giảm giá:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoupons();
  }, []);

  return {
    coupons,
    loading,
  };
}
