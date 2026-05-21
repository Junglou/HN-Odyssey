import { useState } from "react";

// hooks
export function useProductDetailMain() {
  // states
  const [isWishlisted, setIsWishlisted] = useState(false);

  // handlers
  const handleWishlistToggle = () => {
    setIsWishlisted((prev) => !prev);
  };

  return {
    isWishlisted,
    handleWishlistToggle,
  };
}
