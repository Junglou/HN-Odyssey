import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../../../api/axiosClient";
import { Action, Resource } from "../../../../types/permissions";
import { toast } from "react-toastify";
import { getCurrentUser, hasPermission } from "../../../../utils/permission";
import { getApiErrorMessage } from "../../../../utils/apiError";

export interface InventoryKPI {
  title: string;
  value: string;
  subtext: string;
  iconType: "box" | "dollar" | "truck" | "refresh";
}

export interface StockTrendData {
  date: string;
  inward: number;
  outward: number;
}

export interface InventoryAlert {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  minThreshold: number;
  maxThreshold: number | null; // null = không giới hạn
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "OVER_STOCK";
}

export interface StockMovementRow {
  id: string;
  sku: string;
  name: string;
  openingQty: number;
  inward: number;
  outward: number;
  adjustments: number;
  closingQty: number;
  status: "Safe" | "Low Stock" | "Out of Stock" | "Overstock";
}

// Định nghĩa các type cục bộ
type XntResponseItem = {
  sku: string;
  product_name: string;
  beginning_stock: number;
  in_period: number;
  out_period: number;
  adjustments: number;
  ending_stock: number;
  status: StockMovementRow["status"];
};

type TrendResponseItem = {
  date: string;
  inward: number;
  outward: number;
};

type KpiSummaryAlertItem = {
  _id: string;
  sku: string;
  name: string;
  stock: number;
  min_stock: number;
  max_stock: number | null;
  status: InventoryAlert["status"];
};

// Hàm xử lý Múi giờ (Tránh lỗi lấy ngày UTC bị lùi 1 ngày so với giờ Việt Nam)
const getLocalISODate = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
};

const TABLE_PAGE_SIZE = 5;

export function useInventoryManagement() {
  const navigate = useNavigate();
  const today = getLocalISODate(new Date());

  const user = getCurrentUser();
  const canExport = hasPermission(user, Resource.REPORT_STOCK, Action.EXPORT);

  // State bộ lọc
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setDate(1); // Mặc định đầu tháng
    return getLocalISODate(start);
  });
  const [endDate, setEndDate] = useState(today);

  const [tablePage, setTablePage] = useState(1);
  const [tableTotalPages, setTableTotalPages] = useState(1);
  const [isTableLoading, setIsTableLoading] = useState(false);

  // [FIX 1]: Khai báo rõ kiểu string | null thay vì chỉ null
  const [dateError, setDateError] = useState<string | null>(null);

  // State dữ liệu
  const [isLoading, setIsLoading] = useState(true);

  // [FIX 2]: Bơm Generics vào useState để tránh lỗi never[]
  const [kpis, setKpis] = useState<InventoryKPI[]>([]);
  const [trendData, setTrendData] = useState<StockTrendData[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [tableData, setTableData] = useState<StockMovementRow[]>([]);

  const [triggerCount, setTriggerCount] = useState(0);

  const fetchTableData = useCallback(
    async (page: number) => {
      setIsTableLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(TABLE_PAGE_SIZE),
        });
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);

        const res = await axiosClient.get(
          "/reports/inventory/xnt?" + params.toString(),
        );
        if (!res.data?.success) throw new Error("XNT request failed");

        const raw = res.data.data;
        const rows: XntResponseItem[] = Array.isArray(raw)
          ? raw
          : raw?.data || [];

        setTableData(
          rows.map((item) => ({
            id: item.sku,
            sku: item.sku,
            name: item.product_name,
            openingQty: item.beginning_stock,
            inward: item.in_period,
            outward: item.out_period,
            adjustments: item.adjustments,
            closingQty: item.ending_stock,
            status: item.status,
          })),
        );
        setTablePage(page);
        setTableTotalPages(Math.max(Number(res.data.meta?.totalPages) || 1, 1));
      } catch (error) {
        console.warn("xnt request failed:", error);
        setTableData([]);
        setTablePage(1);
        setTableTotalPages(1);
      } finally {
        setIsTableLoading(false);
      }
    },
    [startDate, endDate],
  );

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      const queryString = queryParams.toString();

      // Gọi API kpi-summary dành riêng cho Dashboard Báo Cáo
      const [trendRes, summaryRes] = await Promise.allSettled([
        axiosClient.get("/reports/inventory/trend?" + queryString),
        axiosClient.get("/reports/inventory/kpi-summary?" + queryString),
      ]);

      // Promise.allSettled không throw, nên phải tự log để dễ debug
      [trendRes, summaryRes].forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(
            ["trend", "kpi-summary"][i] + " request failed:",
            r.reason,
          );
        }
      });

      // 2. Dữ liệu Biểu đồ (Trend)
      let trends: StockTrendData[] = [];
      if (trendRes.status === "fulfilled" && trendRes.value.data?.success) {
        const rawTrend = trendRes.value.data.data;
        const trendDataArray = Array.isArray(rawTrend)
          ? rawTrend
          : rawTrend?.data || [];

        trends = trendDataArray.map((item: TrendResponseItem) => ({
          date: item.date,
          inward: item.inward,
          outward: item.outward,
        }));
      }

      // 3. Dữ liệu Cảnh báo & Tồn kho tổng (Từ kpi-summary chuẩn)
      let alertList: InventoryAlert[] = [];
      let summaryTotalItems = 0;
      let summaryLowStockCount = 0;

      if (summaryRes.status === "fulfilled" && summaryRes.value.data?.success) {
        const summaryData = summaryRes.value.data.data;
        summaryTotalItems = summaryData.totalItems || 0;
        summaryLowStockCount = summaryData.lowStockCount || 0;

        if (Array.isArray(summaryData.alerts)) {
          alertList = summaryData.alerts.map((s: KpiSummaryAlertItem) => ({
            id: s._id || s.sku,
            sku: s.sku,
            name: s.name || "Unknown Product",
            // Dùng ?? thay vì || để giá trị 0 không bị đổi thành số mặc định
            currentStock: s.stock ?? 0,
            minThreshold: s.min_stock ?? 0,
            maxThreshold: s.max_stock ?? null,
            status: s.status,
          }));
        }
      }

      // 4. KPIs
      const kpisData: InventoryKPI[] = [
        {
          title: "Total Items in Stock",
          value: summaryTotalItems.toLocaleString(),
          subtext: "Across selected time",
          iconType: "box",
        },
        {
          title: "Low Stock Items",
          value: summaryLowStockCount.toString(),
          subtext: "Requires immediate attention",
          iconType: "truck",
        },
        {
          title: "Inward Transactions",
          value: trends
            .reduce((acc, curr) => acc + curr.inward, 0)
            .toLocaleString(),
          subtext: "Total imported items",
          iconType: "refresh",
        },
        {
          title: "Outward Transactions",
          value: trends
            .reduce((acc, curr) => acc + curr.outward, 0)
            .toLocaleString(),
          subtext: "Total exported items",
          iconType: "dollar",
        },
      ];
      setTrendData(trends);
      setAlerts(alertList);
      setKpis(kpisData);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
    fetchTableData(1); // đổi filter thì luôn quay về trang 1
  }, [fetchDashboardData, fetchTableData, triggerCount]);

  const handleTablePageChange = (page: number) => {
    if (page < 1 || page > tableTotalPages || page === tablePage) return;
    fetchTableData(page);
  };

  const validateDates = (start: string, end: string) => {
    if (!start || !end) {
      setDateError("Vui lòng chọn đầy đủ từ ngày và đến ngày.");
      return false;
    }
    if (new Date(start) > new Date(end)) {
      setDateError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setDateError(null);

    if (filter !== "Custom Range") {
      const end = new Date();
      const start = new Date();

      if (filter === "Today") {
        // start và end đều là today
      } else if (filter === "This Week") {
        start.setDate(
          end.getDate() - end.getDay() + (end.getDay() === 0 ? -6 : 1),
        );
      } else if (filter === "This Month") {
        start.setDate(1);
      } else if (filter === "Last 30 Days") {
        start.setDate(end.getDate() - 30);
      }

      setStartDate(getLocalISODate(start));
      setEndDate(getLocalISODate(end));
      setTriggerCount((prev) => prev + 1);
    }
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (endDate) validateDates(date, endDate);
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date);
    if (startDate) validateDates(startDate, date);
  };

  const handleApply = () => {
    if (activeFilter === "Custom Range" && !validateDates(startDate, endDate))
      return;
    setTriggerCount((prev) => prev + 1);
  };

  const handleExportExcel = async () => {
    if (!canExport)
      return toast.error("Bạn không có quyền xuất dữ liệu Excel báo cáo Kho.");
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      const response = await axiosClient.get(
        "/reports/inventory/xnt/export/excel?" + queryParams.toString(),
        { responseType: "blob" },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = getLocalISODate(new Date()).replace(/-/g, "");
      link.setAttribute("download", "BaoCaoXNT_" + dateStr + ".xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi khi xuất báo cáo Excel."));
      console.error(err);
    }
  };

  const handleExportPdf = async () => {
    if (!canExport)
      return toast.error("Bạn không có quyền xuất PDF báo cáo Kho.");
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      const response = await axiosClient.get(
        "/reports/inventory/xnt/export/pdf?" + queryParams.toString(),
        { responseType: "blob" },
      );

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      const dateStr = getLocalISODate(new Date()).replace(/-/g, "");
      link.setAttribute("download", "BaoCaoXNT_" + dateStr + ".pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi khi xuất báo cáo PDF."));
      console.error(err);
    }
  };

  // [FIX 3]: Thay thế cú pháp Template Literal chứa ký hiệu dễ lỗi markdown bằng cú pháp nối chuỗi cổ điển (+)
  const handleAlertAction = (sku: string, type: "PO" | "TRANSFER") => {
    navigate("/portal/warehouse?sku=" + sku + "&action=" + type);
  };

  return {
    activeFilter,
    startDate,
    endDate,
    dateError,
    isLoading,
    kpis,
    trendData,
    alerts,
    tableData,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
    handleExportExcel,
    handleExportPdf,
    handleAlertAction,
    permissions: { canExport },
    tablePage,
    tableTotalPages,
    isTableLoading,
    handleTablePageChange,
  };
}
