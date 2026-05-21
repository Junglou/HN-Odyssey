import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function useProductCard(productId: string) {
  const navigate = useNavigate();
  const [isWishlisted, setIsWishlisted] = useState(false);

  const handleCardClick = () => {
    navigate(`/products/${productId}`);
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWishlisted((prev) => !prev);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: add to cart logic
  };

  return {
    isWishlisted,
    handleCardClick,
    handleHeartClick,
    handleAddToCart,
  };
}
