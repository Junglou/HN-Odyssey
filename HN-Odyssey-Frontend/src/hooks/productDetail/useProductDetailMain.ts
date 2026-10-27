import { useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import type { ProductDetailState } from "./useProductDetail";
import { useTracking, BehaviorAction } from "../common/useTracking";
import { buildBuyNowCheckoutUrl } from "../../utils/buyNow";
import { getApiErrorMessage } from "../../utils/apiError";

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

      // ưu tiên trạng thái thật từ backend, chỉ tự đảo khi backend không trả isAdded
      const isAdded = response.data?.isAdded;
      if (typeof isAdded === "boolean") {
        setIsWishlisted(isAdded);
      } else {
        setIsWishlisted((prev) => !prev);
      }

      // báo cho Header cập nhật chấm đỏ wishlist
      window.dispatchEvent(new Event("wishlist_updated"));
      toast.success(response.data.message || "Đã cập nhật danh sách yêu thích");
    } catch (error: unknown) {
      console.error("Lỗi Wishlist:", error);
      const err = error as INormalizedError;

      if (err?.status === 401) {
        toast.warning("Vui lòng đăng nhập để lưu sản phẩm!");
      } else {
        toast.error(
          getApiErrorMessage(
            error,
            "Có lỗi xảy ra khi cập nhật danh sách yêu thích.",
          ),
        );
      }
    }
  };

  const handleAddToCart = async (
    product: ProductDetailState,
    selectedOptions: Record<string, string>,
    quantity: number,
  ): Promise<boolean> => {
    if (product.hasVariants) {
      const missingOptions = product.options.filter(
        (opt) => !selectedOptions[opt.code],
      );
      if (missingOptions.length > 0) {
        setOptionError(
          `Vui lòng chọn: ${missingOptions.map((m) => m.label).join(", ")}.`,
        );
        return false;
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
      // báo cho Header/CartDropdown fetch lại giỏ hàng
      window.dispatchEvent(new Event("cart_updated"));
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
      return true;
    } catch (error: unknown) {
      console.error("Lỗi Add to Cart:", error);
      const err = error as INormalizedError;

      setOptionError(err.message || "Lỗi khi thêm vào giỏ hàng");
      toast.error(err.message || "Không thể thêm vào giỏ hàng");
      return false;
    }
  };

  const handleProcessToCheckout = async (
    product: ProductDetailState,
    selectedOptions: Record<string, string>,
    quantity: number,
  ) => {
    const added = await handleAddToCart(product, selectedOptions, quantity);
    if (!added) return; // Thêm giỏ lỗi -> ở lại trang để khách thấy lỗi

    // Chỉ thanh toán đúng sản phẩm này, không kéo theo các món khác trong giỏ
    window.location.href = buildBuyNowCheckoutUrl({
      productId: product.id,
      sku: product.sku,
    });
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
