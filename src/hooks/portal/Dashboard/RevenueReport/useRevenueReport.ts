import { useState, useCallback, useMemo } from "react";

export interface RevenueMetric {
  value: string;
  trend: string;
  isUp: boolean;
}

export interface TrendDataPoint {
  date: string;
  revenue: number;
}

export interface TopProduct {
  rank: number;
  name: string;
  sku: string;
  qty: number;
  revenue: string;
}

export function useRevenueReport() {
  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>("2024-05-01");
  const [endDate, setEndDate] = useState<string>("2024-05-31");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  // thêm state quản lý trạng thái sắp xếp cột
  const [sortKey, setSortKey] = useState<keyof TopProduct | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [metrics] = useState<Record<string, RevenueMetric>>({
    totalRevenue: { value: "$250,500.00", trend: "+15%", isUp: true },
    totalOrders: { value: "1,850", trend: "+8%", isUp: true },
    itemsSold: { value: "4,200", trend: "+10%", isUp: true },
    avgOrderValue: { value: "$135.40", trend: "+1%", isUp: true },
  });

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([
    { date: "May 1", revenue: 10000 },
    { date: "May 5", revenue: 25000 },
    { date: "May 10", revenue: 80000 },
    { date: "May 15", revenue: 85000 },
    { date: "May 17", revenue: 90245 },
    { date: "May 19", revenue: 80000 },
    { date: "May 21", revenue: 150000 },
    { date: "May 24", revenue: 190000 },
    { date: "May 28", revenue: 100000 },
    { date: "May 30", revenue: 160000 },
  ]);

  const [topProducts] = useState<TopProduct[]>([
    {
      rank: 1,
      name: "Grey Jacket",
      sku: "GJ-COT-001",
      qty: 500,
      revenue: "$12,500.00",
    },
    {
      rank: 2,
      name: "Slim-Fit Jeans",
      sku: "JN-SLM-002",
      qty: 350,
      revenue: "$24,500.00",
    },
    {
      rank: 3,
      name: "Black Jacket",
      sku: "BJ-COT-003",
      qty: 200,
      revenue: "$30,000.00",
    },
    {
      rank: 4,
      name: "Survival Knife",
      sku: "SUR-KNF-004",
      qty: 150,
      revenue: "$45,000.00",
    },
    {
      rank: 5,
      name: "Leather Belt",
      sku: "LB-LTH-005",
      qty: 120,
      revenue: "$5,000.00",
    },
    {
      rank: 6,
      name: "Cotton T-Shirt",
      sku: "CT-T-006",
      qty: 100,
      revenue: "$2,000.00",
    },
  ]);

  // logic sắp xếp toàn bộ dữ liệu trước khi phân trang
  const sortedProducts = useMemo(() => {
    if (!sortKey) return topProducts;

    return [...topProducts].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // xử lý riêng cho cột doanh thu vì nó chứa ký tự $ và dấu phẩy
      if (sortKey === "revenue") {
        const numA = parseFloat(String(aValue).replace(/[^0-9.-]+/g, ""));
        const numB = parseFloat(String(bValue).replace(/[^0-9.-]+/g, ""));
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      // sắp xếp chữ hoặc số thông thường
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [topProducts, sortKey, sortDirection]);

  // cắt mảng đã sắp xếp để lấy dữ liệu trang hiện tại
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProducts, currentPage]);

  const totalPages = Math.ceil(topProducts.length / itemsPerPage);

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
  };

  const validateDates = (start: string, end: string) => {
    if (!start || !end) {
      setDateError("vui lòng chọn đầy đủ ngày bắt đầu và kết thúc");
      return false;
    }
    const startObj = new Date(start);
    const endObj = new Date(end);
    const todayObj = new Date();
    if (startObj > endObj) {
      setDateError("ngày bắt đầu không được lớn hơn ngày kết thúc");
      return false;
    }
    if (endObj > todayObj) {
      setDateError("không thể xem báo cáo cho ngày ở tương lai");
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
    const today = new Date();
    if (filter === "Today") {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (filter === "This Week") {
      const firstDay = new Date(
        today.setDate(today.getDate() - today.getDay() + 1),
      );
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(new Date()));
    } else if (filter === "This Month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(new Date()));
    }
  };

  const handleApply = useCallback(() => {
    if (!validateDates(startDate, endDate)) return;
    setIsLoading(true);
    setCurrentPage(1);
    setTimeout(() => {
      setTrendData((prev) =>
        prev.map((item) => ({
          ...item,
          revenue: item.revenue * (Math.random() * 0.4 + 0.8),
        })),
      );
      setIsLoading(false);
    }, 1000);
  }, [startDate, endDate]);

  // hàm bắt sự kiện click vào tiêu đề cột
  const handleSort = (key: keyof TopProduct) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return {
    activeFilter,
    startDate,
    endDate,
    metrics,
    trendData,
    paginatedProducts,
    totalPages,
    currentPage,
    isLoading,
    dateError,
    sortKey,
    sortDirection,
    handleFilterChange,
    setStartDate: (d: string) => {
      setStartDate(d);
      validateDates(d, endDate);
      setCurrentPage(1);
    },
    setEndDate: (d: string) => {
      setEndDate(d);
      validateDates(startDate, d);
      setCurrentPage(1);
    },
    handleApply,
    handlePageChange: (page: number) => setCurrentPage(page),
    handleSort,
  };
}
