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
  // FIX 1: Khai báo trường query_id để Frontend nhận
  query_id?: string;
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
  // FIX 2: Khai báo các định dạng queryID mà Algolia hay trả về
  queryID?: string;
  __queryID?: string;
  query_id?: string; // tên trường backend thực sự trả về
}

interface DiscoverResponse {
  test_group?: string;
  data?: BackendProduct[];
  products?: BackendProduct[];
}

interface RelatedResponse {
  title?: string;
  type?: string;
  products?: BackendProduct[];
}

interface AuthUser {
  _id?: string | { $oid: string };
  id?: string;
  [key: string]: unknown;
}

const getOrCreateSessionId = (): string => {
  const SESSION_KEY = "guestSessionId"; // trùng key với mọi tracking event
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

export function useProductRecommendations(productId?: string) {
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

        let rawData: BackendProduct[] = [];

        if (!userId) {
          // 1A. KHÁCH: Algolia Related Items theo sản phẩm đang xem (model Trained, có queryID)
          // Chờ trang tải xong productId rồi mới gọi, tránh phát request Trending thừa
          if (!productId) return;
          try {
            const response = await axiosClient.get<RelatedResponse>(
              "/recommendations/personalized/related",
              { params: { product_id: productId, session_id: sessionId } },
            );
            rawData = (response.data?.products || []).filter(
              (p) => p._id !== productId,
            );
          } catch {
            console.warn("Lỗi khi gọi Related Items, chuẩn bị Fallback...");
          }
        } else {
          // 1B. ĐÃ ĐĂNG NHẬP: lõi AI Python (Collaborative Filtering)
          try {
            const response = await axiosClient.get<DiscoverResponse>(
              "/recommendations/discover",
              { params: { session_id: sessionId, user_id: userId } },
            );
            rawData = response.data?.data || response.data?.products || [];
          } catch {
            console.warn("Lỗi khi gọi AI, chuẩn bị Fallback...");
          }
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

              // FIX 3: Bóc queryID từ Backend truyền ra ngoài để Component Card có thể gửi Tracking
              query_id: item.query_id || item.queryID || item.__queryID,
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
  }, [productId]);

  return {
    recommendations,
    isLoading,
    error,
  };
}
