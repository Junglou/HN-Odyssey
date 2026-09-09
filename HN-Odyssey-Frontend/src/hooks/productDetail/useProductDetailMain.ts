import { useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import type { ProductDetailState } from "./useProductDetail";
import { useTracking, BehaviorAction } from "../common/useTracking"; // [BỔ SUNG]

interface INormalizedError {
  status?: number;
  message?: string;
  data?: unknown;
}

const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("guestSessionId", sessionId);
  }
  return sessionId;
};

export function useProductDetailMain() {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [optionError, setOptionError] = useState("");
  const { trackEvent } = useTracking(); // [BỔ SUNG] Khai báo hook tracking

  const handleWishlistToggle = async (productId: string) => {
    try {
      const response = await axiosClient.post("/users/wishlist/toggle", {
        productId,
      });
      setIsWishlisted((prev) => !prev);
      toast.success(response.data.message || "Đã cập nhật danh sách yêu thích");
    } catch (error: unknown) {
      console.error("Lỗi Wishlist:", error);
      const err = error as INormalizedError;

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
      await axiosClient.post("/cart/add", {
        productId: product.id,
        variantSku: product.sku,
        quantity: quantity,
        guestSessionId: getGuestSessionId(),
      });
      toast.success("Đã thêm sản phẩm vào giỏ hàng thành công!");

      // [BỔ SUNG] Bắn sự kiện thêm giỏ hàng cho AI Algolia
      trackEvent({
        action: BehaviorAction.ADD_TO_CART,
        path: window.location.pathname,
        metadata: {
          product_id: product.id,
          variant_id: product.sku,
          quantity: quantity,
          price: product.price,
        },
      });
    } catch (error: unknown) {
      console.error("Lỗi Add to Cart:", error);
      const err = error as INormalizedError;

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
