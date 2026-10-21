import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
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

// axiosClient trả lỗi đã chuẩn hóa dạng { status, message, data }
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
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

// Hàm tiện ích lấy guestSessionId (dùng chung key "guestSessionId" với giỏ hàng)
const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("guestSessionId", sessionId);
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
      const res = await axiosClient.get("/users/wishlist");

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

      const res = await axiosClient.post("/users/wishlist/toggle", body);

      // Bổ sung check an toàn: Nếu API trả về isAdded: true nghĩa là bị lỗi gửi sai ID
      // (Nó đã tự động thêm 1 cái mới vào DB)
      const data = res.data as { isAdded?: boolean; message?: string };
      if (data.isAdded) {
        console.warn(
          "Cảnh báo: Dữ liệu không khớp, Backend đã thêm mới thay vì xóa.",
        );
      }

      toast.success(data.message || "Đã xóa sản phẩm khỏi wishlist!");

      // báo cho Header cập nhật chấm đỏ wishlist
      window.dispatchEvent(new Event("wishlist_updated"));

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

      await axiosClient.post("/cart/add", payload);
      // báo cho Header/CartDropdown fetch lại giỏ hàng
      window.dispatchEvent(new Event("cart_updated"));

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
