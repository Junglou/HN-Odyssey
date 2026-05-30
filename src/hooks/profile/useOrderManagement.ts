import { useState, useEffect } from "react";
import type { UserOrder } from "../../types/user";
import { INITIAL_MOCK_USERS } from "./userData";

export function useOrderManagement() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng gọi API để lấy đơn hàng của người dùng
    const fetchOrders = async () => {
      try {
        // Đảm bảo orders luôn được lấy từ cùng một user
        const userData = INITIAL_MOCK_USERS;
        const userOrders = userData.userOrders || [];

        setOrders(userOrders);
      } catch (error) {
        console.error("Không thể tải đơn hàng:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  return {
    orders,
    loading,
  };
}
