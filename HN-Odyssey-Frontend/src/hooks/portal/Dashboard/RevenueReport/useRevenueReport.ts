import { useState, useCallback, useMemo, useEffect } from "react";
import axiosClient from "../../../../api/axiosClient";
import { Action, Resource } from "../../../../types/permissions";
import { toast } from "react-toastify";
import {
  getExportErrorMessage,
  saveBlobResponse,
} from "../../../../utils/exportFile";
import { getCurrentUser, hasPermission } from "../../../../utils/permission";
import { formatPeriod, listDatesBetween } from "../../../../utils/reportFormat";

export interface RevenueMetric {
  value: string;
  trend: string;
  isUp: boolean;
}

export interface TrendDataPoint {
  date: string; // "YYYY-MM-DD" (theo ngày) hoặc "HH:00" (theo giờ)
  revenue: number;
  orders: number;
}

export type TrendGranularity = "hour" | "day";

// US.87 AC6: tỷ trọng doanh thu theo phương thức thanh toán
export interface PaymentShare {
  method: string;
  label: string;
  revenue: number;
  percentage: number;
}

// US.87 AC7: tình trạng thực thu
export interface CashFlow {
  paid: number;
  pending: number;
}

// Khối "Sales from Chatbot"
export interface ChatbotSalesView {
  revenue: number;
  orders: number;
  revenueShare: number;
  ordersShare: number;
  chatbotAov: number;
  webAov: number;
  revenueGrowth: number;
  suggestionConversations: number;
  convertedConversations: number;
  conversionRate: number;
  trend: TrendDataPoint[];
  topProducts: {
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

// GET /reports/dashboard/chatbot-sales
interface ChatbotSalesResponse {
  chatbot_revenue: number;
  chatbot_orders: number;
  revenue_share_percent: number;
  orders_share_percent: number;
  chatbot_aov: number;
  web_aov: number;
  revenue_growth_percent: number;
  suggestion_conversations: number;
  converted_conversations: number;
  conversion_rate_percent: number;
  chart_data: ChartDataPoint[];
  top_products: {
    product_id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
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

// GET /admin/reports/business/revenue — chỉ lấy phần dùng cho US.87 AC6, AC7
interface BusinessRevenueResponse {
  paymentShares: { method: string; revenue: number; percentage: number }[];
  cashFlow: { paidAmount: number; pendingAmount: number };
}

interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Bộ lọc đã áp dụng thành công — màn hình, Excel, PDF đều theo bộ lọc này
interface AppliedFilter {
  filterName: string;
  start: string;
  end: string;
}

const formatDateStr = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

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

// Hàm thuần, nằm ngoài hook → dùng trong useCallback không cần khai báo dependency.
// So sánh chuỗi YYYY-MM-DD vì new Date("YYYY-MM-DD") là 7h sáng giờ VN.
const getDateRangeError = (start: string, end: string): string | null => {
  if (!start || !end) return "Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc";
  if (start > end) return "Ngày bắt đầu không được lớn hơn ngày kết thúc";
  if (end > formatDateStr(new Date()))
    return "Không thể xem báo cáo cho ngày ở tương lai";
  return null;
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "COD (Cash on Delivery)",
  VNPAY: "VNPAY",
  MOMO: "MoMo",
};

const toPaymentLabel = (method: string): string => {
  const key = (method || "").toUpperCase();
  if (PAYMENT_LABELS[key]) return PAYMENT_LABELS[key];
  return key && key !== "UNKNOWN" && key !== "NULL" ? method : "Other";
};

// US.87 AC4: so với "kỳ liền kề trước đó" → nhãn phải đúng theo bộ lọc
const getComparisonLabel = (filterName: string): string => {
  switch (filterName) {
    case "Today":
      return "vs yesterday";
    case "This Week":
      return "vs last week";
    case "This Month":
      return "vs last month";
    default:
      return "vs previous period";
  }
};

// US.87 AC1 + AC8: Hôm nay → đủ 24 khung giờ; kỳ khác → đủ từng ngày; không có đơn = 0
const buildTrendSeries = (
  raw: ChartDataPoint[],
  filterName: string,
  start: string,
  end: string,
): TrendDataPoint[] => {
  const byLabel = new Map(raw.map((c) => [c.label, c]));
  const labels =
    filterName === "Today"
      ? Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`)
      : listDatesBetween(start, end);

  return labels.map((label) => {
    const hit = byLabel.get(label);
    return {
      date: label,
      revenue: Number(hit?.revenue ?? 0),
      orders: Number(hit?.orders ?? 0),
    };
  });
};

export function useRevenueReport() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>(
    formatDateStr(firstDayOfMonth),
  );
  const [endDate, setEndDate] = useState<string>(formatDateStr(today));
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>({
    filterName: "This Month",
    start: formatDateStr(firstDayOfMonth),
    end: formatDateStr(today),
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
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
  const [paymentShares, setPaymentShares] = useState<PaymentShare[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlow>({ paid: 0, pending: 0 });
  const [chatbotSales, setChatbotSales] = useState<ChatbotSalesView | null>(
    null,
  );

  // Quyền chỉ dùng để ẩn/hiện nút — Backend vẫn kiểm tra lại
  const user = getCurrentUser();
  const canExport = hasPermission(user, Resource.REPORT_REVENUE, Action.EXPORT);

  // -------------------------------------------------------------
  // EXPORT EXCEL — theo bộ lọc ĐÃ ÁP DỤNG (US.95 AC3)
  // -------------------------------------------------------------
  const handleExportExcel = async () => {
    if (!canExport) {
      toast.error("Bạn không có quyền xuất dữ liệu Excel Báo cáo Doanh thu.");
      return;
    }
    try {
      setIsExporting(true);
      const response = await axiosClient.get<Blob>(
        "/admin/reports/export/revenue/excel",
        {
          params: {
            time_filter: getApiFilter(appliedFilter.filterName),
            start_date: `${appliedFilter.start}T00:00:00.000Z`,
            end_date: `${appliedFilter.end}T23:59:59.999Z`,
          },
          responseType: "blob",
        },
      );
      const dateStr = formatDateStr(new Date()).replace(/-/g, "");
      const result = await saveBlobResponse(
        response,
        `RevenueReport_${dateStr}.xlsx`,
      );
      if (result.kind === "queued") toast.info(result.message);
      else toast.success("Đã tải báo cáo Excel.");
    } catch (err) {
      console.error(err);
      toast.error(
        await getExportErrorMessage(err, "Lỗi khi xuất báo cáo Excel."),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const validateDates = (start: string, end: string): boolean => {
    const error = getDateRangeError(start, end);
    setDateError(error);
    return error === null;
  };

  const fetchReportData = useCallback(
    async (filterName: string, start: string, end: string) => {
      const rangeError = getDateRangeError(start, end);
      setDateError(rangeError);
      if (rangeError) return;

      setIsLoading(true);
      setCurrentPage(1);

      try {
        const params: Record<string, string> = {
          time_filter: getApiFilter(filterName),
          start_date: `${start}T00:00:00.000Z`,
          end_date: `${end}T23:59:59.999Z`,
        };

        const [overviewRes, topProductsRes, businessRes, chatbotRes] =
          await Promise.all([
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
            // US.87 AC6, AC7 — lỗi ở API này không được làm hỏng cả trang
            axiosClient
              .get<
                BaseResponse<BusinessRevenueResponse>
              >("/admin/reports/business/revenue", { params })
              .catch((error: unknown) => {
                console.error("Lỗi khi tải phân tích thanh toán:", error);
                return null;
              }),
            // Sales from Chatbot — lỗi API này không được làm hỏng cả trang
            axiosClient
              .get<
                BaseResponse<ChatbotSalesResponse>
              >("/reports/dashboard/chatbot-sales", { params })
              .catch((error: unknown) => {
                console.error("Lỗi khi tải doanh thu từ chatbot:", error);
                return null;
              }),
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

        // US.87 AC1, AC8: luôn đủ khung giờ/ngày, không có đơn = 0
        setTrendData(
          buildTrendSeries(overview.chart_data ?? [], filterName, start, end),
        );

        const formattedProducts: TopProduct[] = products.map((p, index) => ({
          rank: index + 1,
          name: p.name,
          sku: p.variants && p.variants.length > 0 ? p.variants[0].sku : "N/A",
          qty: p.total_quantity,
          revenue: formatCurrency(p.total_revenue),
        }));

        setTopProducts(formattedProducts);

        // US.87 AC6, AC7: thanh toán & thực thu (không có dữ liệu → 0, AC8)
        const business = businessRes?.data?.data;
        setPaymentShares(
          (business?.paymentShares ?? []).map((p) => ({
            method: p.method,
            label: toPaymentLabel(p.method),
            revenue: Number(p.revenue) || 0,
            percentage: Number(p.percentage) || 0,
          })),
        );
        setCashFlow({
          paid: Number(business?.cashFlow?.paidAmount ?? 0),
          pending: Number(business?.cashFlow?.pendingAmount ?? 0),
        });

        const bot = chatbotRes?.data?.data;
        setChatbotSales(
          bot
            ? {
                revenue: Number(bot.chatbot_revenue) || 0,
                orders: Number(bot.chatbot_orders) || 0,
                revenueShare: Number(bot.revenue_share_percent) || 0,
                ordersShare: Number(bot.orders_share_percent) || 0,
                chatbotAov: Number(bot.chatbot_aov) || 0,
                webAov: Number(bot.web_aov) || 0,
                revenueGrowth: Number(bot.revenue_growth_percent) || 0,
                suggestionConversations:
                  Number(bot.suggestion_conversations) || 0,
                convertedConversations:
                  Number(bot.converted_conversations) || 0,
                conversionRate: Number(bot.conversion_rate_percent) || 0,
                // Đủ khung giờ/ngày, không có đơn = 0 (giống biểu đồ doanh thu)
                trend: buildTrendSeries(
                  bot.chart_data ?? [],
                  filterName,
                  start,
                  end,
                ),
                topProducts: (bot.top_products ?? []).map((p) => ({
                  productId: p.product_id,
                  name: p.name,
                  quantity: Number(p.quantity) || 0,
                  revenue: Number(p.revenue) || 0,
                })),
              }
            : null,
        );

        setAppliedFilter({ filterName, start, end });
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
      newStart = formatDateStr(todayDate);
      newEnd = formatDateStr(todayDate);
    } else if (filter === "This Week") {
      const day = todayDate.getDay();
      const diff = todayDate.getDate() - day + (day === 0 ? -6 : 1);
      const firstDayOfWeek = new Date(todayDate.setDate(diff));
      newStart = formatDateStr(firstDayOfWeek);
      newEnd = formatDateStr(new Date());
    } else if (filter === "This Month") {
      const firstDay = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        1,
      );
      newStart = formatDateStr(firstDay);
      newEnd = formatDateStr(new Date());
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
    trendGranularity: (appliedFilter.filterName === "Today"
      ? "hour"
      : "day") as TrendGranularity,
    period: formatPeriod(appliedFilter.start, appliedFilter.end),
    comparisonLabel: getComparisonLabel(appliedFilter.filterName),
    paymentShares,
    cashFlow,
    chatbotSales,
    paginatedProducts,
    totalPages,
    currentPage,
    isLoading,
    isExporting,
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
    handleExportExcel,
    permissions: { canExport },
  };
}
