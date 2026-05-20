import { useState, useEffect, useMemo } from "react";
// TODO: import axiosClient from "../../../api/axiosClient";

// types
export type ProductItem = {
  id: string;
  sku: string;
  type: "product";
  name: string;
  desc: string;
  price: number;
  imageUrl: string;
  tags: string[];
};

export type BannerItem = {
  id: string;
  type: "banner";
  title: string;
  subtitle: string;
  btnText: string;
  span: number;
  imageDesktopUrl: string;
  targetUrl: string;
  status: string;
  position: string;
};

export type GridItem = ProductItem | BannerItem;

// mock data
const MOCK_PRODUCTS: ProductItem[] = [
  {
    id: "p1",
    sku: "JCK-001",
    type: "product",
    name: "Summit Softshell Jacket",
    desc: "Grey-blue softshell",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/94a3b8/fff?text=Product+1",
    tags: ["New Arrival"],
  },
  {
    id: "p2",
    sku: "JCK-002",
    type: "product",
    name: "Alpine Puffer Jacket",
    desc: "Navy puffer",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/1e3a8a/fff?text=Product+2",
    tags: ["Winter"],
  },
  {
    id: "p3",
    sku: "JCK-003",
    type: "product",
    name: "Trailblazer Rain Jacket",
    desc: "Green rain jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/166534/fff?text=Product+3",
    tags: [],
  },
  {
    id: "p4",
    sku: "JCK-004",
    type: "product",
    name: "Expedition Shell Jacket",
    desc: "Orange shell jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/ea580c/fff?text=Product+4",
    tags: ["Sale"],
  },
  {
    id: "p5",
    sku: "JCK-005",
    type: "product",
    name: "Summit Softshell Jacket",
    desc: "Grey-blue softshell",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/cbd5e1/000?text=Product+5",
    tags: [],
  },
  {
    id: "p6",
    sku: "JCK-006",
    type: "product",
    name: "Alpine Puffer Jacket",
    desc: "Grey puffer",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/64748b/fff?text=Product+6",
    tags: [],
  },
  {
    id: "p7",
    sku: "JCK-007",
    type: "product",
    name: "Expedition Shell Jacket",
    desc: "Grey shell jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/334155/fff?text=Product+7",
    tags: ["New Arrival"],
  },
  {
    id: "p8",
    sku: "JCK-008",
    type: "product",
    name: "Trailblazer Rain Jacket",
    desc: "Navy rain jacket",
    price: 35.99,
    imageUrl: "https://via.placeholder.com/400x383/1e40af/fff?text=Product+8",
    tags: [],
  },
];

const MOCK_BANNERS: BannerItem[] = [
  {
    id: "b1",
    type: "banner",
    title: "Get it now!",
    subtitle: "Wrap yourself in comfort and style.",
    btnText: "Explore",
    span: 2,
    imageDesktopUrl:
      "https://via.placeholder.com/800x400/e5e7eb/000?text=Banner+1",
    targetUrl: "/products/promo-1",
    status: "ACTIVE",
    position: "Category",
  },
  {
    id: "b2",
    type: "banner",
    title: "Summer Sale",
    subtitle: "Up to 50% off on all items.",
    btnText: "Shop Now",
    span: 1,
    imageDesktopUrl:
      "https://via.placeholder.com/400x400/fecaca/000?text=Banner+2",
    targetUrl: "/products/promo-2",
    status: "ACTIVE",
    position: "Promotion",
  },
];

export function useProductList() {
  // states quản lý bộ lọc và phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [activeTabs, setActiveTabs] = useState<string[]>(["All"]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortValue, setSortValue] = useState("Sort by");

  // states chứa dữ liệu trả về từ API
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // fetch data mỗi khi các tham số thay đổi
  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);
      try {
        // TODO: Mở comment và gắn API thật khi BE hoàn thiện
        // const [productRes, bannerRes] = await Promise.all([
        //   axiosClient.get("/products", {
        //     params: {
        //       page: currentPage,
        //       limit: itemsPerPage,
        //       tabs: activeTabs.join(","),
        //       filters: selectedFilters.join(","),
        //       sort: sortValue,
        //     },
        //   }),
        //   axiosClient.get("/marketing/content/banners?status=ACTIVE&position=Category"),
        // ]);

        // TODO: mapping data
        // setProducts(productRes.data.items);
        // setTotalItems(productRes.data.total);
        // setBanners(bannerRes.data.items);

        // fallback mock data (Xóa phần này khi nối API)
        setProducts(MOCK_PRODUCTS);
        setBanners(MOCK_BANNERS);
        setTotalItems(MOCK_PRODUCTS.length);
      } catch (error) {
        console.error("Failed to fetch listings:", error);
        // TODO: Xử lý hiển thị toast báo lỗi
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [currentPage, itemsPerPage, activeTabs, selectedFilters, sortValue]);

  // chèn banner vào danh sách sản phẩm lấy được
  const mixedItems = useMemo(() => {
    const mixed: GridItem[] = [...products];
    const activeBanners = banners.filter((b) => b.status === "ACTIVE");

    let bannerIndex = 0;
    let insertPos = 4; // chèn sau mỗi 4 sản phẩm

    while (bannerIndex < activeBanners.length && insertPos <= mixed.length) {
      mixed.splice(insertPos, 0, activeBanners[bannerIndex]);
      bannerIndex++;
      insertPos += 5;
    }

    while (bannerIndex < activeBanners.length) {
      mixed.push(activeBanners[bannerIndex]);
      bannerIndex++;
    }

    return mixed;
  }, [products, banners]);

  // tính tổng số trang dựa trên totalItems từ BE
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // actions
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleTabChange = (tab: string) => {
    setActiveTabs((prev) => {
      if (tab === "All") return ["All"];
      let newTabs = prev.filter((t) => t !== "All");
      if (newTabs.includes(tab)) {
        newTabs = newTabs.filter((t) => t !== tab);
      } else {
        newTabs.push(tab);
      }
      return newTabs.length === 0 ? ["All"] : newTabs;
    });
    setCurrentPage(1);
  };

  const handleFilterToggle = (optionId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId],
    );
    setCurrentPage(1);
  };

  const handleSortChange = (val: string) => {
    setSortValue(val);
    setCurrentPage(1);
  };

  return {
    gridItems: mixedItems, // xuất thẳng mảng đã mix, API lo việc giới hạn (limit)
    currentPage,
    totalPages,
    activeTabs,
    selectedFilters,
    sortValue,
    isLoading, // TODO: Truyền trạng thái này xuống Component để hiển thị Skeleton/Spinner
    handlePageChange,
    handleTabChange,
    handleFilterToggle,
    handleSortChange,
  };
}
