import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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

// 2. HÀM TIỆN ÍCH TẠO SESSION CHO GUEST
const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
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
  query_id?: string, // Đã nhận từ Frontend component
  position?: number, // Đã nhận từ Frontend component
) {
  const navigate = useNavigate();

  const [isWishlisted, setIsWishlisted] = useState<boolean>(initialWishlisted);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState<boolean>(false);

  useEffect(() => {
    setIsWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  // FIX 1: Bắn Tracking khi user BẤM VÀO SẢN PHẨM (Xem chi tiết)
  const handleCardClick = () => {
    // Gọi API ngầm (Fire & Forget) không cần await để không làm chậm thao tác chuyển trang của user
    axiosClient
      .post("/tracking/event", {
        session_id: getGuestSessionId(),
        // Nếu có query_id tức là user bấm từ khu vực Recommend của AI, nếu không là click bình thường
        action: query_id ? "CLICK_SEARCH_SUGGESTION" : "VIEW_PRODUCT",
        path: `/product/${slug}`,
        device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
        metadata: {
          product_id: productId,
          query_id: query_id, // Truyền cho Algolia
          position: position, // Truyền cho Algolia
        },
      })
      .catch((err) => console.error("Tracking Error:", err));

    navigate(`/products/${slug}`);
  };

  // 3. XỬ LÝ THÊM/BỎ WISHLIST
  const handleHeartClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingWishlist) return;

    setIsTogglingWishlist(true);
    try {
      const response = await axiosClient.post<IWishlistToggleResponse>(
        "/users/wishlist/toggle",
        { productId },
      );

      if (response.data.success) {
        setIsWishlisted(response.data.isAdded);
        toast.success(response.data.message);
      }
    } catch (error: unknown) {
      console.error("Lỗi Wishlist:", error);
      const err = error as INormalizedError;

      if (err.status === 401) {
        toast.warning(
          "Vui lòng đăng nhập để sử dụng tính năng danh sách yêu thích!",
        );
        navigate("/login");
      } else {
        toast.error(
          err.message || "Có lỗi xảy ra khi cập nhật danh sách yêu thích.",
        );
      }
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  // 4. XỬ LÝ THÊM VÀO GIỎ HÀNG
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      // Nếu sản phẩm có biến thể, bấm vào giỏ hàng sẽ chuyển hướng sang trang chi tiết
      handleCardClick();
      return;
    }
    if (isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      const payload: IAddToCartPayload = {
        productId,
        variantSku,
        quantity: 1,
        guestSessionId: getGuestSessionId(),
      };

      await axiosClient.post("/cart/add", payload);
      toast.success("Đã thêm sản phẩm vào giỏ hàng thành công!");

      // FIX 2: Bắn Tracking khi user BẤM THÊM VÀO GIỎ HÀNG THÀNH CÔNG
      axiosClient
        .post("/tracking/event", {
          session_id: getGuestSessionId(),
          action: "CLICK_ADD_TO_CART",
          path: `/product/${slug}`,
          device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
          metadata: {
            product_id: productId,
            query_id: query_id, // Truyền cho Algolia
            position: position, // Truyền cho Algolia
          },
        })
        .catch((err) => console.error("Tracking Error:", err));
    } catch (error: unknown) {
      console.error("Lỗi Add to Cart:", error);
      const err = error as INormalizedError;
      toast.error(err.message || "Có lỗi xảy ra khi thêm vào giỏ hàng.");
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
