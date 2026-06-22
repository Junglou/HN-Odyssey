import { useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import type { ProductDetailState } from "./useProductDetail";

// --- KHAI BÁO TYPE CHO LỖI TRẢ VỀ TỪ AXIOS ---
interface INormalizedError {
  status?: number;
  message?: string;
  data?: unknown;
}

const getGuestSessionId = (): string => {
  // Đổi từ "guest_session_id" thành "guestSessionId"
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    // Đổi từ "guest_session_id" thành "guestSessionId"
    localStorage.setItem("guestSessionId", sessionId);
  }
  return sessionId;
};

export function useProductDetailMain() {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [optionError, setOptionError] = useState("");

  const handleWishlistToggle = async (productId: string) => {
    try {
      const response = await axiosClient.post("/users/wishlist/toggle", {
        productId,
      });
      setIsWishlisted((prev) => !prev);
      toast.success(response.data.message || "Đã cập nhật danh sách yêu thích");
    } catch (error: unknown) {
      // Đổi any thành unknown
      console.error("Lỗi Wishlist:", error);
      const err = error as INormalizedError; // Ép kiểu an toàn

      if (err?.status === 401) {
        toast.warning("Vui lòng đăng nhập để lưu sản phẩm!");
      }
    }
  };

  const handleAddToCart = async (
    product: ProductDetailState,
    selectedOptions: Record<string, string>,
    quantity: number,
  ) => {
    // Ràng buộc phải chọn đủ các option NẾU SP đó là dạng có biến thể (has_variants = true)
    if (product.hasVariants) {
      const missingOptions = product.options.filter(
        (opt) => !selectedOptions[opt.code],
      );
      if (missingOptions.length > 0) {
        setOptionError(
          `Vui lòng chọn: ${missingOptions.map((m) => m.label).join(", ")}.`,
        );
        return;
      }
    }
    setOptionError("");

    try {
      // Gọi API chuẩn theo Schema của giỏ hàng backend
      await axiosClient.post("/cart/add", {
        productId: product.id,
        variantSku: product.sku, // Hook phía trước đã tự map Sku đúng biến thể
        quantity: quantity,
        guestSessionId: getGuestSessionId(),
      });
      toast.success("Đã thêm sản phẩm vào giỏ hàng thành công!");
    } catch (error: unknown) {
      // Đổi any thành unknown
      console.error("Lỗi Add to Cart:", error);
      const err = error as INormalizedError; // Ép kiểu an toàn

      setOptionError(err.message || "Lỗi khi thêm vào giỏ hàng");
      toast.error(err.message || "Không thể thêm vào giỏ hàng");
    }
  };

  const handleProcessToCheckout = async (
    product: ProductDetailState,
    selectedOptions: Record<string, string>,
    quantity: number,
  ) => {
    await handleAddToCart(product, selectedOptions, quantity);
    // Chuyển thẳng qua trang checkout
    window.location.href = "/checkout";
  };

  const clearOptionError = () => setOptionError("");

  return {
    isWishlisted,
    optionError,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
    clearOptionError,
  };
}
