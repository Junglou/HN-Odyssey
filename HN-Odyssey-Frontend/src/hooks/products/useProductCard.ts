import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify"; // Thêm import toast
import axiosClient from "../../api/axiosClient";

// 1. KHAI BÁO GIAO DIỆN CHẶT CHẼ THEO BACKEND DTO
interface IWishlistToggleResponse {
  success: boolean;
  message: string;
  isAdded: boolean;
}

interface IAddToCartPayload {
  productId: string;
  variantSku: string;
  quantity: number;
  guestSessionId?: string;
}

interface INormalizedError {
  status?: number;
  message?: string;
  data?: unknown;
}

// 2. HÀM TIỆN ÍCH TẠO SESSION CHO GUEST (Người dùng chưa đăng nhập)
const getGuestSessionId = (): string => {
  // Đổi từ "guest_session_id" thành "guestSessionId"
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    // Tạo ID ngẫu nhiên kết hợp timestamp
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    // Đổi từ "guest_session_id" thành "guestSessionId"
    localStorage.setItem("guestSessionId", sessionId);
  }
  return sessionId;
};

export function useProductCard(
  productId: string,
  slug: string,
  variantSku: string,
  hasVariants: boolean,
  initialWishlisted: boolean,
) {
  const navigate = useNavigate();

  // 2. Đặt giá trị mặc định là initialWishlisted nhận từ danh sách
  const [isWishlisted, setIsWishlisted] = useState<boolean>(initialWishlisted);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState<boolean>(false);

  // 3. Đảm bảo state luôn đồng bộ nếu initialWishlisted từ API thay đổi
  useEffect(() => {
    setIsWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  const handleCardClick = () => {
    navigate(`/products/${slug}`);
  };

  // 3. XỬ LÝ THÊM/BỎ WISHLIST
  const handleHeartClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra thẻ card bên ngoài
    if (isTogglingWishlist) return; // Chống click spam

    setIsTogglingWishlist(true);
    try {
      const response = await axiosClient.post<IWishlistToggleResponse>(
        "/users/wishlist/toggle",
        { productId },
      );

      if (response.data.success) {
        setIsWishlisted(response.data.isAdded);
        toast.success(response.data.message); // Chuyển từ alert sang toast.success
      }
    } catch (error: unknown) {
      console.error("Lỗi Wishlist:", error);
      const err = error as INormalizedError;

      // Backend yêu cầu Auth Guard cho Wishlist, nếu 401 thì nhắc nhở
      if (err.status === 401) {
        toast.warning(
          "Vui lòng đăng nhập để sử dụng tính năng danh sách yêu thích!",
        ); // Chuyển từ alert sang toast.warning
        navigate("/login");
      } else {
        toast.error(
          err.message || "Có lỗi xảy ra khi cập nhật danh sách yêu thích.",
        ); // Chuyển từ alert sang toast.error
      }
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  // 4. XỬ LÝ THÊM VÀO GIỎ HÀNG
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      navigate(`/products/${slug}`);
      return;
    }
    if (isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      const payload: IAddToCartPayload = {
        productId,
        variantSku,
        quantity: 1, // Mặc định mua 1 món khi bấm từ giao diện list ngoài
        guestSessionId: getGuestSessionId(),
      };

      await axiosClient.post("/cart/add", payload);
      toast.success("Đã thêm sản phẩm vào giỏ hàng thành công!"); // Chuyển từ alert sang toast.success
    } catch (error: unknown) {
      console.error("Lỗi Add to Cart:", error);
      const err = error as INormalizedError;
      toast.error(err.message || "Có lỗi xảy ra khi thêm vào giỏ hàng."); // Chuyển từ alert sang toast.error
    } finally {
      setIsAddingToCart(false);
    }
  };

  return {
    isWishlisted,
    isAddingToCart,
    isTogglingWishlist,
    handleCardClick,
    handleHeartClick,
    handleAddToCart,
  };
}
