import type { Product } from "../../types/product";
import {
  useRecommendProduct,
  PROFILE_RECOMMEND_COUNT,
} from "./useRecommendProduct";

export const PROFILE_RECOMMENDATION_COUNT = PROFILE_RECOMMEND_COUNT;

/** Profile sidebar recommendations — cart API (same as checkout), then personalized/discover fallback. */
export function useProfileRecommendations(
  count: number = PROFILE_RECOMMENDATION_COUNT,
): Product[] {
  const { products } = useRecommendProduct(count);
  return products;
}
