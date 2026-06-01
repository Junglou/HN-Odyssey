import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import type { Product } from "../../types/product";
import tokenStorage from "../../utils/tokenStorage";
import {
  clampPaginationPage,
  useResponsiveProfilePagination,
} from "./useResponsiveOrderPageLimit";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SESSION_KEY = "hn_analytics_session_id";
const RECENT_VIEW_STORAGE_KEY = "hn_profile_recent_views_v1";
const LAST_VIEWED_PRODUCT_KEY = "hn_last_viewed_product_id";
const MAX_RECENT_ITEMS = 12;

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export const isValidMongoObjectId = (
  value: string | undefined | null,
): boolean => !!value && OBJECT_ID_RE.test(value);

const getOrCreateSessionId = (): string => {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  localStorage.setItem(SESSION_KEY, id);
  return id;
};

const readStoredRecentViews = (): Product[] => {
  try {
    const raw = localStorage.getItem(RECENT_VIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Product[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => isValidMongoObjectId(item?.id));
  } catch {
    return [];
  }
};

const writeStoredRecentViews = (items: Product[]) => {
  localStorage.setItem(
    RECENT_VIEW_STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)),
  );
};

/** Remember a product id from a product-detail visit (valid MongoDB id only). */
export const rememberLastViewedProductId = (productId: string) => {
  if (!isValidMongoObjectId(productId)) return;
  sessionStorage.setItem(LAST_VIEWED_PRODUCT_KEY, productId);
};

/** Persist a product the user viewed (valid MongoDB id only). */
export const recordRecentViewProduct = (product: Product) => {
  if (!isValidMongoObjectId(product.id)) return;

  const next = [
    product,
    ...readStoredRecentViews().filter((item) => item.id !== product.id),
  ].slice(0, MAX_RECENT_ITEMS);

  writeStoredRecentViews(next);
};

const getAuthHeadersIfValidUser = () => {
  const token = tokenStorage.getToken();
  if (!token) return {};

  const user = tokenStorage.getUser() as { _id?: string; id?: string } | null;
  const userId = user?._id ?? user?.id;
  if (!isValidMongoObjectId(userId ? String(userId) : undefined)) {
    return {};
  }

  return { headers: { Authorization: `Bearer ${token}` } };
};

const paginateProducts = (
  items: Product[],
  page: number,
  limit: number,
): Product[] => {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
};

export function useRecentViewManagement() {
  const [recentView, setRecentView] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, limit, setPage, resetPage, pagination } =
    useResponsiveProfilePagination();
  const [totalFiltered, setTotalFiltered] = useState(0);

  const fetchRecentView = useCallback(async () => {
    setLoading(true);
    try {
      const stored = readStoredRecentViews();

      if (stored.length === 0) {
        setTotalFiltered(0);
        setRecentView([]);
        return;
      }

      const totalCount = stored.length;
      const maxPage = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;
      const safePage = clampPaginationPage(page, maxPage);

      setTotalFiltered(totalCount);
      if (safePage !== page) setPage(safePage);
      setRecentView(paginateProducts(stored, safePage, limit));
    } finally {
      setLoading(false);
    }
  }, [page, limit, setPage]);

  const syncRecentViewProductById = useCallback(
    async (productId: string) => {
      if (!isValidMongoObjectId(productId)) return;

      const existing = readStoredRecentViews().find(
        (item) => item.id === productId,
      );
      if (existing) {
        recordRecentViewProduct(existing);
        await fetchRecentView();
        return;
      }

      try {
        const res = await axios.get(`${API_URL}/products/${productId}`);
        const raw = (res.data?.data ?? res.data) as {
          _id?: string;
          id?: string;
          name?: string;
          description?: string;
          short_description?: string;
          price?: number;
          sale_price?: number;
          thumbnail?: string;
          images?: string[];
          gallery?: { url?: string }[];
        };

        const galleryUrls =
          raw.gallery?.map((m) => m.url).filter((u): u is string => !!u) ?? [];
        const images = [
          ...(raw.thumbnail ? [raw.thumbnail] : []),
          ...(raw.images ?? []),
          ...galleryUrls,
        ];
        const salePrice = Number(raw.sale_price ?? 0);
        const basePrice = Number(raw.price ?? 0);
        const displayPrice = salePrice > 0 ? salePrice : basePrice;

        const product: Product = {
          id: String(raw._id ?? raw.id ?? productId),
          name: raw.name ?? "",
          description: (raw.short_description || raw.description || "").trim(),
          price: displayPrice,
          image: images[0] ?? "",
        };

        recordRecentViewProduct(product);
        const all = readStoredRecentViews();
        const totalCount = all.length;
        const maxPage = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;
        const safePage = clampPaginationPage(page, maxPage);
        setTotalFiltered(totalCount);
        if (safePage !== page) setPage(safePage);
        setRecentView(paginateProducts(all, safePage, limit));
      } catch {
        // Non-blocking: product detail may still be viewable elsewhere
      }
    },
    [fetchRecentView, limit, page, setPage],
  );

  useEffect(() => {
    void fetchRecentView();
  }, [fetchRecentView]);

  useEffect(() => {
    const pendingId = sessionStorage.getItem(LAST_VIEWED_PRODUCT_KEY);
    if (!pendingId || !isValidMongoObjectId(pendingId)) return;
    sessionStorage.removeItem(LAST_VIEWED_PRODUCT_KEY);
    void syncRecentViewProductById(pendingId);
  }, [syncRecentViewProductById]);

  const clearRecentView = async () => {
    writeStoredRecentViews([]);
    setTotalFiltered(0);
    resetPage();
    await fetchRecentView();

    try {
      const sessionId = getOrCreateSessionId();
      await axios.delete(`${API_URL}/recommendations/recently-viewed`, {
        params: { session_id: sessionId },
        ...getAuthHeadersIfValidUser(),
      });
      toast.success("Đã xóa lịch sử xem sản phẩm.");
    } catch (err: unknown) {
      console.error("Lỗi xóa lịch sử xem:", err);
      toast.error(
        "Không thể xóa lịch sử xem trên máy chủ, đã xóa trên thiết bị.",
      );
    }
  };

  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / limit) : 0;
  const startIndex = (page - 1) * limit;

  const actions = {
    changePage: (nextPage: number) => setPage(nextPage),
    changeLimit: () => resetPage(),
    refresh: () => fetchRecentView(),
  };

  return {
    recentView,
    loading,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered,
      startIndex,
    },
    actions,
    clearRecentView,
    refresh: fetchRecentView,
    recordRecentViewProduct,
    syncRecentViewProductById,
  };
}
