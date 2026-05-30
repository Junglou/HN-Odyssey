import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import type { UserProfile } from "../../types/user";
import { INITIAL_MOCK_USERS } from "./userData";

export function useWishlistManagement() {
  const [wishlist, setWishlist] = useState<UserProfile["userWishlist"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng gọi API để lấy đơn hàng của người dùng
    const fetchOrders = async () => {
      try {
        const userWishlist = INITIAL_MOCK_USERS.userWishlist || [];
        setWishlist(userWishlist);
      } catch (error) {
        console.error("Không thể tải danh sách yêu thích:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const deleteWishlistItem = (productId: string) => {
    setWishlist((currentWishlist) =>
      currentWishlist.filter((item) => item.id !== productId),
    );
    toast.success("Đã xóa sản phẩm khỏi wishlist!");
  };

  return {
    wishlist,
    loading,
    deleteWishlistItem,
  };
}
