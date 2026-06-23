import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../../../api/axiosClient";

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
  maxThreshold: number;
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

type StockResponseItem = {
  _id?: string;
  sku: string;
  name?: string;
  product_name?: string;
  stock: number;
  min_stock: number;
  max_stock: number;
};

// Hàm xử lý Múi giờ (Tránh lỗi lấy ngày UTC bị lùi 1 ngày so với giờ Việt Nam)
const getLocalISODate = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
};

export function useInventoryManagement() {
  const navigate = useNavigate();
  const today = getLocalISODate(new Date());

  // State bộ lọc
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setDate(1); // Mặc định đầu tháng
    return getLocalISODate(start);
  });
  const [endDate, setEndDate] = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);

  // [ĐIỂM SỬA 1]: Đổi giá trị mặc định thành "all" để đồng bộ với Dropdown
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");

  // State dữ liệu
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<InventoryKPI[]>([]);
  const [trendData, setTrendData] = useState<StockTrendData[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [tableData, setTableData] = useState<StockMovementRow[]>([]);
  const [triggerCount, setTriggerCount] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      // [ĐIỂM SỬA 2]: Mở cờ gọi API lọc Kho, gửi param nếu chọn kho cụ thể
      if (selectedWarehouse !== "all") {
        queryParams.append("warehouse", selectedWarehouse);
      }

      const queryString = queryParams.toString();

      const [xntRes, trendRes, stockRes] = await Promise.allSettled([
        axiosClient.get(`/reports/inventory/xnt?${queryString}&limit=50`),
        axiosClient.get(`/reports/inventory/trend?${queryString}`),
        axiosClient.get(`/inventory/stock?limit=100`),
      ]);

      // 1. Dữ liệu Bảng (XNT)
      let tableRows: StockMovementRow[] = [];
      let totalItems = 0;
      let lowStockCount = 0;

      if (xntRes.status === "fulfilled" && xntRes.value.data?.success) {
        const rawXnt = xntRes.value.data.data;
        const xntData = Array.isArray(rawXnt) ? rawXnt : rawXnt?.data || [];

        tableRows = xntData.map((item: XntResponseItem) => ({
          id: item.sku,
          sku: item.sku,
          name: item.product_name,
          openingQty: item.beginning_stock,
          inward: item.in_period,
          outward: item.out_period,
          adjustments: item.adjustments,
          closingQty: item.ending_stock,
          status: item.status,
        }));

        totalItems = tableRows.reduce((sum, item) => sum + item.closingQty, 0);
        lowStockCount = tableRows.filter((item) =>
          ["Low Stock", "Out of Stock"].includes(item.status),
        ).length;
      }

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

      // 3. Dữ liệu Cảnh báo (Low Stock)
      let alertList: InventoryAlert[] = [];
      if (stockRes.status === "fulfilled" && stockRes.value.data?.success) {
        const rawStock = stockRes.value.data.data;
        const stocks = Array.isArray(rawStock)
          ? rawStock
          : rawStock?.data || [];

        if (Array.isArray(stocks)) {
          alertList = stocks
            .filter(
              (s: StockResponseItem) =>
                s.stock <= s.min_stock ||
                s.stock >= s.max_stock ||
                s.stock === 0,
            )
            .map((s: StockResponseItem) => ({
              id: s._id || s.sku,
              sku: s.sku,
              name: s.name || s.product_name || "Unknown Product",
              currentStock: s.stock || 0,
              minThreshold: s.min_stock || 10,
              maxThreshold: s.max_stock || 100,
            }));
        }
      }

      // Fallback lấy cảnh báo từ bảng XNT nếu API stock không trả về kịp
      if (alertList.length === 0 && tableRows.length > 0) {
        alertList = tableRows
          .filter((item) => item.status !== "Safe")
          .map((item) => ({
            id: item.sku,
            sku: item.sku,
            name: item.name,
            currentStock: item.closingQty,
            minThreshold: 10,
            maxThreshold: 100,
          }));
      }

      // 4. KPIs
      const kpisData: InventoryKPI[] = [
        {
          title: "Total Items in Stock",
          value: totalItems.toLocaleString(),
          subtext: "Across selected time",
          iconType: "box",
        },
        {
          title: "Low Stock Items",
          value: lowStockCount.toString(),
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

      setTableData(tableRows);
      setTrendData(trends);
      setAlerts(alertList);
      setKpis(kpisData);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedWarehouse]); // Đã bổ sung selectedWarehouse vào dependencies

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, triggerCount]);

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

      // Sử dụng getLocalISODate để ép chuẩn múi giờ khi set State
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

  const handleWarehouseChange = (warehouse: string) => {
    setSelectedWarehouse(warehouse);
    setTriggerCount((prev) => prev + 1); // Trigger lại API nếu đổi kho
  };

  const handleExportExcel = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      const response = await axiosClient.get(
        `/reports/inventory/xnt/export/excel?${queryParams.toString()}`,
        { responseType: "blob" },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = getLocalISODate(new Date()).replace(/-/g, "");
      link.setAttribute("download", `BaoCaoXNT_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi khi xuất báo cáo Excel.");
      console.error(err);
    }
  };

  // 2. THÊM HÀM MỚI: Xuất PDF
  const handleExportPdf = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("start_date", startDate);
      if (endDate) queryParams.append("end_date", endDate);

      const response = await axiosClient.get(
        `/reports/inventory/xnt/export/pdf?${queryParams.toString()}`,
        { responseType: "blob" },
      );

      // Lưu ý type của Blob phải là application/pdf
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      const dateStr = getLocalISODate(new Date()).replace(/-/g, "");
      link.setAttribute("download", `BaoCaoXNT_${dateStr}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi khi xuất báo cáo PDF.");
      console.error(err);
    }
  };

  const handleAlertAction = (sku: string, type: "PO" | "TRANSFER") => {
    navigate(`/portal/warehouse?sku=${sku}&action=${type}`);
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
    selectedWarehouse,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
    handleWarehouseChange,
    handleExportExcel,
    handleExportPdf,
    handleAlertAction,
  };
}
