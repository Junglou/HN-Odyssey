import { useState, useEffect } from "react";
import type { UserOrder } from "../../types/user";
import { INITIAL_MOCK_USERS } from "./userData";

export function useHistoryManagement() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng gọi API để lấy đơn hàng của người dùng
    const fetchOrders = async () => {
      try {
        const userOrders = INITIAL_MOCK_USERS.userFinishedOrders || [];
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