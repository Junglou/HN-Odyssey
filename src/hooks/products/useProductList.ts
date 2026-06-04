import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

const getFullImageUrl = (url?: string): string => {
  if (!url) return "https://placehold.co/400x383/f3f4f6/000?text=No+Image";
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const serverRootUrl = baseUrl.replace(/\/api.*$/, "").replace(/\/$/, "");
  const formattedUrl = url.startsWith("/") ? url : `/${url}`;
  return `${serverRootUrl}${formattedUrl}`;
};

type BEProductItem = {
  _id: string;
  sku: string;
  slug: string;
  has_variants?: boolean;
  name: string;
  short_description?: string;
  price: number;
  sale_price: number;
  thumbnail?: string;
  tags?: string[];
};

type BEFilterOption = {
  label: string;
  value: string;
  meta?: string;
  count: number;
  disabled: boolean;
};

type BEFilterSection = {
  code: string;
  name: string;
  type: string;
  min?: number;
  max?: number;
  options?: BEFilterOption[];
};

export type BECategory = {
  _id: string;
  name: string;
  slug: string;
  children?: BECategory[];
};

type BEBannerItem = {
  _id: string;
  title: string;
  link: string;
  image_pc: string;
  status: string;
};

export type ProductItem = {
  id: string;
  sku: string;
  slug: string;
  hasVariants: boolean;
  type: "product";
  name: string;
  desc: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  imageUrl: string;
  tags: string[];
  initialWishlisted: boolean;
};

export type BannerItem = {
  id: string;
  type: "banner";
  title: string;
  subtitle: string;
  btnText: string;
  shape: "square" | "horizontal" | "vertical" | "small";
  imageDesktopUrl: string;
  targetUrl: string;
  status: string;
  position: string;
};

export type GridItem = ProductItem | BannerItem;

export type FilterOption = {
  id: string;
  label: string;
  value: string;
  count: number;
  disabled: boolean;
};

export type FilterSection = {
  id: string;
  name: string;
  type: string;
  min?: number;
  max?: number;
  options: FilterOption[];
};

export type CategoryTab = {
  name: string;
  slug: string;
};

export function useProductList() {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") || "";
  const categoryFromUrl = searchParams.get("category") || "all";
  const filterFromUrl = searchParams.get("filter");

  // 1. NHẬN DIỆN THÔNG MINH KEYWORD ĐỂ CHUYỂN THÀNH STATE BỘ LỌC (SORT)
  const normalizedKeyword = keyword.trim().toLowerCase();
  let initialSort = "Newest";
  if (normalizedKeyword === "trending") initialSort = "Trending";
  else if (normalizedKeyword === "new arrivals") initialSort = "Newest";

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(12);

  const [tabs, setTabs] = useState<CategoryTab[]>([
    { name: "All", slug: "all" },
  ]);

  const [activeTabSlug, setActiveTabSlug] = useState<string>(categoryFromUrl);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    filterFromUrl ? [filterFromUrl] : [],
  );
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);

  // 2. TỰ ĐỘNG GÁN GIÁ TRỊ BAN ĐẦU CHO DROPDOWN BỘ LỌC
  const [sortValue, setSortValue] = useState<string>(initialSort);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);

  const [totalItems, setTotalItems] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 3. ĐỒNG BỘ URL VÀ GIAO DIỆN BỘ LỌC MỖI KHI CLICK CHUYỂN TRANG
  useEffect(() => {
    const cat = searchParams.get("category") || "all";
    setActiveTabSlug(cat);

    // Xử lý tự động tick/bỏ tick khi URL thay đổi
    const filter = searchParams.get("filter");
    if (filter) {
      setSelectedFilters([filter]);
    } else {
      setSelectedFilters([]);
    }

    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get<BECategory[]>(
          "/categories/tree-view",
        );
        const catData = res.data || [];
        const dynamicTabs = catData.map((c: BECategory) => ({
          name: c.name,
          slug: c.slug,
        }));
        setTabs([{ name: "All", slug: "all" }, ...dynamicTabs]);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | number> = {
          page: currentPage,
          limit: itemsPerPage,
        };

        // 4. CHẶN GỬI "TRENDING" / "NEW ARRIVALS" THÀNH CHUỖI TÌM KIẾM ĐỂ TRÁNH LỖI 0 KẾT QUẢ
        const currentNormalizedKw = keyword.trim().toLowerCase();
        const isSpecialSortKeyword =
          currentNormalizedKw === "trending" ||
          currentNormalizedKw === "new arrivals";

        if (keyword && !isSpecialSortKeyword) {
          params.keyword = keyword;
        }

        if (activeTabSlug !== "all") params.categorySlug = activeTabSlug;

        // Bắt giá trị Sort hiện tại để API xử lý
        if (sortValue === "Trending") params.sort = "trending";
        else if (sortValue === "Price: Low to High") params.sort = "price_asc";
        else if (sortValue === "Price: High to Low") params.sort = "price_desc";
        else if (sortValue === "Newest") params.sort = "newest";

        const attributesMap: Record<string, string[]> = {};
        selectedFilters.forEach((filterId) => {
          const [code, val] = filterId.split(":");
          if (code && val) {
            if (!attributesMap[code]) attributesMap[code] = [];
            attributesMap[code].push(val);
          }
        });

        const finalAttributes: Record<string, string> = {};
        Object.keys(attributesMap).forEach((code) => {
          finalAttributes[code] = attributesMap[code].join(",");
        });

        if (priceRange) {
          finalAttributes.price = `${priceRange[0]},${priceRange[1]}`;
        }

        if (Object.keys(finalAttributes).length > 0) {
          params.attributes = JSON.stringify(finalAttributes);
        }

        const apiRequests: Promise<unknown>[] = [
          axiosClient.get<{ data: BEProductItem[]; meta: { total: number } }>(
            "/products/store/list",
            { params },
          ),
          axiosClient.get<BEFilterSection[]>("/products/filters", { params }),
          axiosClient.get<{ data: BEBannerItem[] }>(
            "/marketing/content/banners/public/active",
            { params: { position: "Category" } },
          ),
        ];

        let wishlistIndex = -1;
        if (tokenStorage.getToken()) {
          apiRequests.push(
            axiosClient.get<{ data: { productId: string }[] }>(
              "/users/wishlist",
            ),
          );
          wishlistIndex = 3;
        }

        const responses = await Promise.all(apiRequests);

        const productRes = responses[0] as {
          data: { data: BEProductItem[]; meta: { total: number } };
        };
        const filterRes = responses[1] as { data: BEFilterSection[] };
        const bannerRes = responses[2] as { data: { data: BEBannerItem[] } };

        const wishlistRes =
          wishlistIndex > -1
            ? (responses[wishlistIndex] as {
                data: { data: { productId: string }[] };
              })
            : undefined;

        const wishlistIds: string[] = wishlistRes?.data?.data
          ? wishlistRes.data.data.map((i: { productId: string }) => i.productId)
          : [];

        const fetchedProducts: ProductItem[] = (
          productRes.data?.data || []
        ).map((p: BEProductItem) => ({
          id: p._id,
          sku: p.sku,
          slug: p.slug,
          hasVariants: p.has_variants || false,
          type: "product",
          name: p.name,
          desc: p.short_description || "",
          price: p.sale_price > 0 ? p.sale_price : p.price,
          originalPrice: p.sale_price > 0 ? p.price : undefined,
          discountBadge:
            p.sale_price > 0
              ? `-${Math.round((1 - p.sale_price / p.price) * 100)}%`
              : undefined,
          imageUrl: getFullImageUrl(p.thumbnail),
          tags: p.tags || [],
          initialWishlisted: wishlistIds.includes(p._id),
        }));

        setProducts(fetchedProducts);
        setTotalItems(productRes.data?.meta?.total || 0);

        const fetchedFilters: FilterSection[] = (filterRes.data || []).map(
          (section: BEFilterSection) => ({
            id: section.code,
            name: section.name,
            type: section.type,
            min: section.min,
            max: section.max,
            options: (section.options || []).map((opt: BEFilterOption) => ({
              id: `${section.code}:${opt.value}`,
              label: opt.label,
              value: opt.value,
              count: opt.count,
              disabled: opt.disabled,
            })),
          }),
        );
        setFilterSections(fetchedFilters);

        const shouldShowBanners = currentPage === 1 && Math.random() <= 0.5;

        if (shouldShowBanners && bannerRes?.data?.data?.length > 0) {
          const fetchedBanners = bannerRes.data.data;

          const randomBanners = [...fetchedBanners]
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);

          const shapePairs = [
            ["horizontal", "horizontal"],
            ["vertical", "vertical"],
            ["horizontal", "vertical"],
            ["square", "square"],
          ];

          const selectedPair =
            shapePairs[Math.floor(Math.random() * shapePairs.length)];

          const formattedBanners: BannerItem[] = randomBanners.map(
            (b, index) => ({
              id: b._id,
              type: "banner",
              title: b.title || "Ưu đãi đặc biệt",
              subtitle: "Khám phá ngay các ưu đãi hấp dẫn dành riêng cho bạn.",
              btnText: "Khám phá",
              shape: (selectedPair[index] || "square") as
                | "square"
                | "horizontal"
                | "vertical",
              imageDesktopUrl: getFullImageUrl(b.image_pc),
              targetUrl: b.link || "/products",
              status: "ACTIVE",
              position: "Category",
            }),
          );

          setBanners(formattedBanners);
        } else {
          setBanners([]);
        }
      } catch (error) {
        console.error("Failed to fetch listings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [
    currentPage,
    itemsPerPage,
    activeTabSlug,
    selectedFilters,
    priceRange,
    sortValue,
    keyword,
  ]);

  const mixedItems = useMemo(() => {
    if (banners.length === 0) return products;

    const mixed: GridItem[] = [...products];

    banners.forEach((banner) => {
      const minPos = Math.min(2, mixed.length);
      const maxPos = mixed.length;

      const randomPos =
        Math.floor(Math.random() * (maxPos - minPos + 1)) + minPos;
      mixed.splice(randomPos, 0, banner);
    });

    return mixed;
  }, [products, banners]);

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page);
    },
    [totalPages],
  );

  const handleTabChange = useCallback((slug: string) => {
    setActiveTabSlug(slug);
    setCurrentPage(1);
    setSelectedFilters([]);
    setPriceRange(null);
  }, []);

  const handleFilterToggle = useCallback((optionId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId],
    );
    setCurrentPage(1);
  }, []);

  const handlePriceChange = useCallback((min: number, max: number) => {
    setPriceRange([min, max]);
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((val: string) => {
    setSortValue(val);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedFilters([]);
    setPriceRange(null);
    setCurrentPage(1);
  }, []);

  return {
    gridItems: mixedItems,
    filterSections,
    tabs,
    activeTabSlug,
    currentPage,
    totalPages,
    selectedFilters,
    priceRange,
    sortValue,
    isLoading,
    handlePageChange,
    handleTabChange,
    handleFilterToggle,
    handlePriceChange,
    handleSortChange,
    handleClearFilters,
  };
}
