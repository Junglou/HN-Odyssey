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
import { useNavigate } from "react-router-dom";

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

// Hàm tiện ích lấy guestSessionId (nếu cần cho add to cart)
const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guest_session_id");
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("guest_session_id", sessionId);
  }
  return sessionId;
};

export function useWishlistManagement() {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const navigate = useNavigate();
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

  // SỬA LỖI: Nhận trực tiếp đối tượng targetItem để đảm bảo không bị nhầm variant
  const deleteWishlistItem = async (targetItem: Product) => {
    try {
      const body: { productId: string; variantId?: string } = {
        productId: targetItem.id, // ID gốc của Product
      };

      if (targetItem.variantId) {
        body.variantId = targetItem.variantId;
      }

      const res = await axios.post(`${API_URL}/users/wishlist/toggle`, body, {
        ...getAuthHeaders(),
      });

      // Bổ sung check an toàn: Nếu API trả về isAdded: true nghĩa là bị lỗi gửi sai ID
      // (Nó đã tự động thêm 1 cái mới vào DB)
      const data = res.data as { isAdded?: boolean; message?: string };
      if (data.isAdded) {
        console.warn(
          "Cảnh báo: Dữ liệu không khớp, Backend đã thêm mới thay vì xóa.",
        );
      }

      toast.success(data.message || "Đã xóa sản phẩm khỏi wishlist!");

      // Gọi lại danh sách để đồng bộ DB với UI
      await fetchWishlist();
    } catch (err: unknown) {
      console.error("Lỗi xóa wishlist:", err);
      toast.error(
        getErrorMessage(err, "Không thể xóa sản phẩm khỏi wishlist."),
      );
    }
  };

  // BỔ SUNG: Hàm Add To Cart từ Wishlist
  const addToCartFromWishlist = async (item: Product) => {
    // 3. BỔ SUNG LUỒNG KIỂM TRA CHUYỂN HƯỚNG
    // Nếu sản phẩm có biến thể NHƯNG chưa lưu variantId (nghĩa là lưu từ trang ngoài)
    if (item.hasVariants && !item.variantId) {
      toast.info("Vui lòng chọn màu sắc/kích cỡ trước khi thêm vào giỏ hàng.");
      navigate(`/products/${item.id}`); // Chuyển hướng sang trang chi tiết
      return;
    }

    if (!item.sku) {
      console.error("Sản phẩm bị thiếu SKU:", item);
      toast.error("Sản phẩm chưa có mã SKU! Vui lòng tải lại trang.");
      return;
    }

    try {
      const payload = {
        productId: item.id,
        variantSku: item.sku,
        quantity: 1,
        guestSessionId: getGuestSessionId(),
      };

      await axios.post(`${API_URL}/cart/add`, payload, {
        ...getAuthHeaders(),
      });

      toast.success("Đã thêm sản phẩm vào giỏ hàng!");
    } catch (err: unknown) {
      console.error("Lỗi thêm vào giỏ hàng:", err);
      toast.error(getErrorMessage(err, "Không thể thêm vào giỏ hàng."));
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
    addToCartFromWishlist, // BỔ SUNG export hàm này ra UI
    refresh: fetchWishlist,
  };
}
