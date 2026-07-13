import { useState, useEffect } from "react";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  slug: string;
  initialWishlisted?: boolean;
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

interface BackendProduct {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  sale_price?: number;
  thumbnail?: string;
  sku?: string;
  has_variants?: boolean;
  tags?: string[];
  is_flash_sale?: boolean;
}

interface DiscoverResponse {
  test_group?: string;
  data?: BackendProduct[];
  products?: BackendProduct[];
}

interface AuthUser {
  _id?: string | { $oid: string };
  id?: string;
  [key: string]: unknown;
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

const getLoggedInUserId = (): string | undefined => {
  const user = tokenStorage.getUser<AuthUser>();
  if (!user) return undefined;

  if (user._id && typeof user._id === "object" && "$oid" in user._id) {
    return String(user._id.$oid);
  }

  const id = user._id || user.id;
  return id ? String(id) : undefined;
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
        const userId = getLoggedInUserId();

        const params: Record<string, string> = { session_id: sessionId };
        if (userId) {
          params.user_id = userId;
        }

        let rawData: BackendProduct[] = [];

        // 1. GỌI LÕI AI PYTHON CÁ NHÂN HÓA
        try {
          const response = await axiosClient.get<DiscoverResponse>(
            "/recommendations/discover",
            { params },
          );
          rawData = response.data?.data || response.data?.products || [];
        } catch {
          console.warn("Lỗi khi gọi AI, chuẩn bị Fallback...");
        }

        // 2. NẾU AI TRẢ RỖNG -> KÍCH HOẠT FALLBACK LẤY HÀNG TRENDING TỪ BE
        if (!rawData || rawData.length === 0) {
          try {
            // Thủ thuật: Gọi lại API nhưng KHÔNG gửi user_id để BE nhả Trending
            const fallbackResponse = await axiosClient.get<DiscoverResponse>(
              "/recommendations/discover",
              { params: { session_id: sessionId } },
            );
            rawData =
              fallbackResponse.data?.data ||
              fallbackResponse.data?.products ||
              [];
          } catch {
            rawData = [];
          }
        }

        // 3. MAP DATA HIỂN THỊ
        if (Array.isArray(rawData) && rawData.length > 0) {
          const mappedProducts: Product[] = rawData.map((item) => {
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
              slug: item.slug || "",
              initialWishlisted: false,
              description: item.description || "",
              desc: item.description || "",
              price: isDiscounted ? salePrice : item.price,
              originalPrice: isDiscounted ? item.price : undefined,
              image: item.thumbnail || "https://via.placeholder.com/470x450",
              imageUrl: item.thumbnail || "https://via.placeholder.com/470x450",
              sku: item.sku,
              hasVariants: item.has_variants,
              tags: item.tags || [],
              type: "product",
              discountBadge: badge,
            };
          });

          setRecommendations(mappedProducts);
        } else {
          setRecommendations([]);
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
