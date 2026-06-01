import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import type { Product } from "../../types/product";
import {
  type WishlistItemApiResponse,
  mapWishlistItemFromApi,
} from "../../utils/mapCustomerWishlist";
import tokenStorage from "../../utils/tokenStorage";
import {
  clampPaginationPage,
  useResponsiveProfilePagination,
} from "./useResponsiveOrderPageLimit";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = tokenStorage.getToken();
  return {
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      fallback
    );
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const paginateProducts = (
  items: Product[],
  page: number,
  limit: number,
): Product[] => {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
};

export function useWishlistManagement() {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const { page, limit, setPage, resetPage, pagination } =
    useResponsiveProfilePagination();
  const [totalFiltered, setTotalFiltered] = useState(0);

  const fetchWishlist = useCallback(async () => {
    if (!tokenStorage.getToken()) {
      setWishlist([]);
      setTotalFiltered(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/wishlist`, {
        ...getAuthHeaders(),
      });

      const payload = res.data;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const mapped = (list as WishlistItemApiResponse[]).map(
        mapWishlistItemFromApi,
      );

      const totalCount = mapped.length;
      const maxPage = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;
      const safePage = clampPaginationPage(page, maxPage);

      setTotalFiltered(totalCount);
      if (safePage !== page) setPage(safePage);
      setWishlist(paginateProducts(mapped, safePage, limit));
    } catch (err: unknown) {
      console.error("Không thể tải danh sách yêu thích:", err);
      toast.error(getErrorMessage(err, "Không thể tải danh sách yêu thích."));
      setWishlist([]);
      setTotalFiltered(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, setPage]);

  useEffect(() => {
    void fetchWishlist();
  }, [fetchWishlist]);

  const deleteWishlistItem = async (productId: string) => {
    const target = wishlist.find((item) => item.id === productId);
    if (!target) return;

    try {
      const body: { productId: string; variantId?: string } = {
        productId: target.id,
      };
      if (target.variantId) {
        body.variantId = target.variantId;
      }

      const res = await axios.post(`${API_URL}/users/wishlist/toggle`, body, {
        ...getAuthHeaders(),
      });

      toast.success(
        (res.data as { message?: string })?.message ||
          "Đã xóa sản phẩm khỏi wishlist!",
      );
      await fetchWishlist();
    } catch (err: unknown) {
      console.error("Lỗi xóa wishlist:", err);
      toast.error(
        getErrorMessage(err, "Không thể xóa sản phẩm khỏi wishlist."),
      );
    }
  };

  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / limit) : 0;
  const startIndex = (page - 1) * limit;

  const actions = {
    changePage: (nextPage: number) => setPage(nextPage),
    changeLimit: () => resetPage(),
    refresh: () => fetchWishlist(),
  };

  return {
    wishlist,
    loading,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered,
      startIndex,
    },
    actions,
    deleteWishlistItem,
    refresh: fetchWishlist,
  };
}
