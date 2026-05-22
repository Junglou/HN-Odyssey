import { useState } from "react";

// types
interface ColorOption {
  id: string;
  hex: string;
  name: string;
  images: string[];
}

// hook
export function useProductDetailMain() {
  // states
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [sizeError, setSizeError] = useState("");

  // handlers
  const handleWishlistToggle = (productId: string) => {
    setIsWishlisted((prev) => !prev);
    // test log khi có api
    console.log("Toggle wishlist cho ID:", productId);
  };

  const handleAddToCart = (
    productId: string,
    color: ColorOption,
    size: string,
    quantity: number,
  ) => {
    if (!size) {
      setSizeError("Vui lòng chọn Kích cỡ.");
      return;
    }
    setSizeError("");
    console.log("Add to cart:", { productId, color, size, quantity });
  };

  const handleProcessToCheckout = (
    productId: string,
    color: ColorOption,
    size: string,
    quantity: number,
  ) => {
    if (!size) {
      setSizeError("Vui lòng chọn Kích cỡ.");
      return;
    }
    setSizeError("");
    console.log("Checkout:", { productId, color, size, quantity });
  };

  const clearSizeError = () => setSizeError("");

  return {
    isWishlisted,
    sizeError,
    handleWishlistToggle,
    handleAddToCart,
    handleProcessToCheckout,
    clearSizeError,
  };
}
