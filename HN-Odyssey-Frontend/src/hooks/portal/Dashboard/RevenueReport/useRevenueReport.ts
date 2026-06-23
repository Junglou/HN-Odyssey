import { useState, useCallback, useMemo, useEffect } from "react";
import axiosClient from "../../../../api/axiosClient";

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

interface ChartDataPoint {
  label: string;
  revenue: number;
  orders: number;
}

interface OverviewResponse {
  net_revenue: number;
  total_orders: number;
  total_items: number;
  prev_net_revenue: number;
  prev_total_orders: number;
  revenue_growth_percent: number;
  orders_growth_percent: number;
  items_growth_percent: number;
  chart_data: ChartDataPoint[];
}

interface TopProductVariant {
  sku: string;
  variant_name?: string;
  quantity: number;
  revenue: number;
  contribution_percent: number;
}

interface TopProductResponse {
  product_id: string;
  name: string;
  image: string;
  total_quantity: number;
  total_revenue: number;
  growth_percent: number;
  variants: TopProductVariant[];
}

interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const formatDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

export function useRevenueReport() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>(formatDate(firstDay));
  const [endDate, setEndDate] = useState<string>(formatDate(today));

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  const [sortKey, setSortKey] = useState<keyof TopProduct | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [metrics, setMetrics] = useState<Record<string, RevenueMetric>>({
    totalRevenue: { value: "$0.00", trend: "0%", isUp: true },
    totalOrders: { value: "0", trend: "0%", isUp: true },
    itemsSold: { value: "0", trend: "0%", isUp: true },
    avgOrderValue: { value: "$0.00", trend: "0%", isUp: true },
  });

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  const getApiFilter = (uiFilter: string): string => {
    switch (uiFilter) {
      case "Today":
        return "TODAY";
      case "This Week":
        return "THIS_WEEK";
      case "This Month":
        return "THIS_MONTH";
      case "Custom Range":
        return "CUSTOM";
      default:
        return "THIS_MONTH";
    }
  };

  const validateDates = (start: string, end: string): boolean => {
    if (!start || !end) {
      setDateError("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc");
      return false;
    }
    const startObj = new Date(start);
    const endObj = new Date(end);
    const todayObj = new Date();

    if (startObj > endObj) {
      setDateError("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return false;
    }
    if (endObj > todayObj) {
      setDateError("Không thể xem báo cáo cho ngày ở tương lai");
      return false;
    }
    setDateError(null);
    return true;
  };

  const fetchReportData = useCallback(
    async (filterName: string, start: string, end: string) => {
      if (!validateDates(start, end)) return;
      setIsLoading(true);
      setCurrentPage(1);

      try {
        const filterParam = getApiFilter(filterName);

        const params: Record<string, string> = {
          time_filter: filterParam,
          start_date: start,
          end_date: end,
        };

        const [overviewRes, topProductsRes] = await Promise.all([
          axiosClient.get<BaseResponse<OverviewResponse>>(
            "/reports/dashboard/overview",
            { params },
          ),
          axiosClient.get<BaseResponse<TopProductResponse[]>>(
            "/reports/dashboard/top-products",
            {
              params: { ...params, sort_by: "REVENUE", sort_order: "DESC" },
            },
          ),
        ]);

        const overview =
          overviewRes.data?.data || ({} as Partial<OverviewResponse>);
        const products = topProductsRes.data?.data || [];

        const formatCurrency = (val: number) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(val);
        const formatNumber = (val: number) =>
          new Intl.NumberFormat("en-US").format(val);

        const netRev = overview.net_revenue || 0;
        const totOrd = overview.total_orders || 0;
        const totItems = overview.total_items || 0;
        const prevNetRev = overview.prev_net_revenue || 0;
        const prevTotOrd = overview.prev_total_orders || 0;

        const revGrowth = overview.revenue_growth_percent || 0;
        const ordGrowth = overview.orders_growth_percent || 0;
        const itemsGrowth = overview.items_growth_percent || 0;

        const aov = totOrd > 0 ? netRev / totOrd : 0;
        const prevAov = prevTotOrd > 0 ? prevNetRev / prevTotOrd : 0;
        let aovGrowth = 0;
        if (prevAov > 0) aovGrowth = ((aov - prevAov) / prevAov) * 100;
        else if (aov > 0) aovGrowth = 100;

        setMetrics({
          totalRevenue: {
            value: formatCurrency(netRev),
            trend: `${revGrowth > 0 ? "+" : ""}${revGrowth.toFixed(1)}%`,
            isUp: revGrowth >= 0,
          },
          totalOrders: {
            value: formatNumber(totOrd),
            trend: `${ordGrowth > 0 ? "+" : ""}${ordGrowth.toFixed(1)}%`,
            isUp: ordGrowth >= 0,
          },
          itemsSold: {
            value: formatNumber(totItems),
            trend: `${itemsGrowth > 0 ? "+" : ""}${itemsGrowth.toFixed(1)}%`,
            isUp: itemsGrowth >= 0,
          },
          avgOrderValue: {
            value: formatCurrency(aov),
            trend: `${aovGrowth > 0 ? "+" : ""}${aovGrowth.toFixed(1)}%`,
            isUp: aovGrowth >= 0,
          },
        });

        if (overview.chart_data) {
          setTrendData(
            overview.chart_data.map((c) => ({
              date: c.label,
              revenue: c.revenue,
            })),
          );
        }

        const formattedProducts: TopProduct[] = products.map((p, index) => ({
          rank: index + 1,
          name: p.name,
          sku: p.variants && p.variants.length > 0 ? p.variants[0].sku : "N/A",
          qty: p.total_quantity,
          revenue: formatCurrency(p.total_revenue),
        }));

        setTopProducts(formattedProducts);
      } catch (error) {
        console.error("Lỗi khi fetch báo cáo doanh thu:", error);
        setDateError("Có lỗi xảy ra khi tải dữ liệu từ máy chủ");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isInitialLoad && startDate && endDate) {
      fetchReportData(activeFilter, startDate, endDate);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, startDate, endDate, activeFilter, fetchReportData]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);

    const todayDate = new Date();
    let newStart = startDate;
    let newEnd = endDate;

    if (filter === "Today") {
      newStart = formatDate(todayDate);
      newEnd = formatDate(todayDate);
    } else if (filter === "This Week") {
      const day = todayDate.getDay();
      const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1);
      const firstDayOfWeek = new Date(todayDate.setDate(diff));
      newStart = formatDate(firstDayOfWeek);
      newEnd = formatDate(new Date());
    } else if (filter === "This Month") {
      const firstDayOfMonth = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1,
      );
      newStart = formatDate(firstDayOfMonth);
      newEnd = formatDate(new Date());
    }

    setStartDate(newStart);
    setEndDate(newEnd);

    if (filter !== "Custom Range") {
      fetchReportData(filter, newStart, newEnd);
    }
  };

  const handleApply = useCallback(() => {
    if (activeFilter === "Custom Range") {
      fetchReportData(activeFilter, startDate, endDate);
    }
  }, [activeFilter, startDate, endDate, fetchReportData]);

  const sortedProducts = useMemo(() => {
    if (!sortKey) return topProducts;

    return [...topProducts].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (sortKey === "revenue") {
        const numA = parseFloat(String(aValue).replace(/[^0-9.-]+/g, ""));
        const numB = parseFloat(String(bValue).replace(/[^0-9.-]+/g, ""));
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [topProducts, sortKey, sortDirection]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProducts, currentPage]);

  const totalPages = Math.ceil(topProducts.length / itemsPerPage) || 1;

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
