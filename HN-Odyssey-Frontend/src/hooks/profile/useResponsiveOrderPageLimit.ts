import { useEffect, useState } from "react";

export const ORDER_PAGE_LIMIT_DEFAULT = 6;
export const ORDER_PAGE_LIMIT_WIDE = 9;
export const ORDER_PAGE_LIMIT_ULTRA_WIDE = 16;
/** Match OrderManagement.css — 3×3 grid above this width */
export const ORDER_WIDE_MIN_WIDTH_PX = 1981;
/** Order Management, Purchase History, Wishlist — 4×4 grid above this width */
export const ORDER_ULTRA_WIDE_MIN_WIDTH_PX = 3000;

export const getOrderPageLimit = (): number => {
  if (typeof window === "undefined") return ORDER_PAGE_LIMIT_DEFAULT;
  return window.innerWidth >= ORDER_WIDE_MIN_WIDTH_PX
    ? ORDER_PAGE_LIMIT_WIDE
    : ORDER_PAGE_LIMIT_DEFAULT;
};

/** 6 / 9 / 16 items for profile order-style grids (Order Mgmt, Purchase History, Wishlist). */
export const getProfileGridPageLimit = (): number => {
  if (typeof window === "undefined") return ORDER_PAGE_LIMIT_DEFAULT;
  if (window.innerWidth >= ORDER_ULTRA_WIDE_MIN_WIDTH_PX) {
    return ORDER_PAGE_LIMIT_ULTRA_WIDE;
  }
  if (window.innerWidth >= ORDER_WIDE_MIN_WIDTH_PX) {
    return ORDER_PAGE_LIMIT_WIDE;
  }
  return ORDER_PAGE_LIMIT_DEFAULT;
};

/** Page size 9 on viewports ≥1981px, otherwise 6. */
export function useResponsiveOrderPageLimit(): number {
  const [limit, setLimit] = useState(getOrderPageLimit);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${ORDER_WIDE_MIN_WIDTH_PX}px)`);
    const sync = () => {
      setLimit(mq.matches ? ORDER_PAGE_LIMIT_WIDE : ORDER_PAGE_LIMIT_DEFAULT);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return limit;
}

/** Page size 16 / 9 / 6 for profile grids that support a 4×4 layout at ≥3000px. */
export function useProfileGridPageLimit(): number {
  const [limit, setLimit] = useState(getProfileGridPageLimit);

  useEffect(() => {
    const ultraWideMq = window.matchMedia(
      `(min-width: ${ORDER_ULTRA_WIDE_MIN_WIDTH_PX}px)`,
    );
    const wideMq = window.matchMedia(
      `(min-width: ${ORDER_WIDE_MIN_WIDTH_PX}px)`,
    );

    const sync = () => setLimit(getProfileGridPageLimit());

    sync();
    ultraWideMq.addEventListener("change", sync);
    wideMq.addEventListener("change", sync);
    return () => {
      ultraWideMq.removeEventListener("change", sync);
      wideMq.removeEventListener("change", sync);
    };
  }, []);

  return limit;
}

/**
 * Profile grid pagination: `page` in state, `limit` from viewport breakpoints.
 * Resets page when limit changes during render (avoids setState inside useEffect).
 */
export function useResponsiveProfilePagination() {
  const limit = useProfileGridPageLimit();
  const [page, setPage] = useState(1);
  const [prevLimit, setPrevLimit] = useState(limit);

  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (page !== 1) {
      setPage(1);
    }
  }

  return {
    page,
    limit,
    setPage,
    resetPage: () => setPage(1),
    pagination: { page, limit },
  };
}

export const clampPaginationPage = (page: number, maxPage: number): number => {
  const safeMax = maxPage > 0 ? maxPage : 1;
  return Math.min(Math.max(1, page), safeMax);
};
