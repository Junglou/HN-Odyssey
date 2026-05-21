import { useState } from "react";

export function useProductDetailMain() {
  const [isWishlisted, setIsWishlisted] = useState(false);

  // handlers
  const handleWishlistToggle = () => {
    setIsWishlisted((prev) => !prev);
  };

  const handleAddToCart = () => {
    // TODO: logic thêm vào giỏ hàng
  };

  const handleProcessToCheckout = () => {
    // TODO: logic chuyển hướng thanh toán
  };

  return {
    isWishlisted,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
  };
}
