import { useState, useEffect } from "react";
import axiosClient from "../../api/axiosClient";

// 1. Khai báo Interface chuẩn của Frontend (Đã bổ sung slug và initialWishlisted để khớp với ProductItem của ProductCard)
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  slug: string; // <-- ĐÃ BỔ SUNG
  initialWishlisted?: boolean; // <-- ĐÃ BỔ SUNG
  desc?: string;
  imageUrl?: string;
  originalPrice?: number;
  discountBadge?: string;
  tags?: string[];
  type?: "product";
  variantId?: string | null;
  sku?: string;
  hasVariants?: boolean;
}

// 2. Khai báo Interface chuẩn của Backend
interface BackendProduct {
  _id: string;
  name: string;
  slug?: string; // <-- ĐÃ BỔ SUNG
  description?: string;
  price: number;
  sale_price?: number;
  thumbnail?: string;
  sku?: string;
  has_variants?: boolean;
  tags?: string[];
  is_flash_sale?: boolean;
}

interface RecommendationResponse {
  title: string;
  type: string;
  products: BackendProduct[];
}

const getOrCreateSessionId = (): string => {
  const SESSION_KEY = "hn_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
};

export function useProductRecommendations() {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const sessionId = getOrCreateSessionId();

        const response = await axiosClient.get<RecommendationResponse>(
          "/recommendations/personalized",
          {
            params: {
              session_id: sessionId,
            },
          },
        );

        if (response.data && Array.isArray(response.data.products)) {
          const mappedProducts: Product[] = response.data.products.map(
            (item) => {
              const salePrice = item.sale_price || 0;
              const isDiscounted = salePrice > 0 && salePrice < item.price;

              let badge: string | undefined = undefined;
              if (item.is_flash_sale) {
                badge = "Hot";
              } else if (isDiscounted) {
                const percent = Math.round((1 - salePrice / item.price) * 100);
                badge = `-${percent}%`;
              } else if (
                item.tags?.includes("New") ||
                item.tags?.includes("new")
              ) {
                badge = "New";
              }

              return {
                id: item._id,
                name: item.name,
                slug: item.slug || "", // <-- MAP DATA TỪ BE
                initialWishlisted: false, // <-- MẶC ĐỊNH LÀ FALSE CHO CÁC SẢN PHẨM GỢI Ý
                description: item.description || "",
                desc: item.description || "",
                price: isDiscounted ? salePrice : item.price,
                originalPrice: isDiscounted ? item.price : undefined,
                image: item.thumbnail || "https://via.placeholder.com/470x450",
                imageUrl:
                  item.thumbnail || "https://via.placeholder.com/470x450",
                sku: item.sku,
                hasVariants: item.has_variants,
                tags: item.tags || [],
                type: "product",
                discountBadge: badge,
              };
            },
          );

          setRecommendations(mappedProducts);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to fetch product recommendations");
        }
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  return {
    recommendations,
    isLoading,
    error,
  };
}
