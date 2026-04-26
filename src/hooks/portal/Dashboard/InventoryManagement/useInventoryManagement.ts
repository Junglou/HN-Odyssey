import { useState, useEffect, useCallback } from "react";

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

export function useInventoryManagement() {
  const today = new Date().toISOString().split("T")[0];

  // state bộ lọc
  const [activeFilter, setActiveFilter] = useState("Last 30 Days");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);

  // state kho hàng (MỚI THÊM)
  const [selectedWarehouse, setSelectedWarehouse] = useState("All Warehouses");

  // state dữ liệu
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<InventoryKPI[]>([]);
  const [trendData, setTrendData] = useState<StockTrendData[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [tableData, setTableData] = useState<StockMovementRow[]>([]);

  // fetch data (giả lập)
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      setKpis([
        {
          title: "Total Stock Value",
          value: "$1.2M",
          subtext: "+5.2% vs last month",
          iconType: "dollar",
        },
        {
          title: "Total Items in Stock",
          value: "45,231",
          subtext: "Across all warehouses",
          iconType: "box",
        },
        {
          title: "Low Stock Items",
          value: "12",
          subtext: "Requires immediate attention",
          iconType: "truck",
        },
        {
          title: "Inventory Turnover",
          value: "4.2",
          subtext: "Target: 5.0",
          iconType: "refresh",
        },
      ]);

      setTrendData([
        { date: "Sep 25", inward: 100, outward: 70 },
        { date: "Sep 26", inward: 120, outward: 85 },
        { date: "Sep 27", inward: 90, outward: 110 },
        { date: "Sep 28", inward: 180, outward: 130 },
        { date: "Sep 29", inward: 110, outward: 90 },
        { date: "Sep 30", inward: 130, outward: 100 },
        { date: "Oct 01", inward: 120, outward: 80 },
        { date: "Oct 02", inward: 150, outward: 90 },
        { date: "Oct 03", inward: 80, outward: 110 },
        { date: "Oct 04", inward: 200, outward: 150 },
        { date: "Oct 05", inward: 90, outward: 130 },
        { date: "Oct 06", inward: 110, outward: 95 },
        { date: "Oct 07", inward: 140, outward: 120 },
        { date: "Oct 08", inward: 160, outward: 140 },
      ]);

      setAlerts([
        {
          id: "1",
          sku: "SKU-TS-001",
          name: "Premium Cotton T-Shirt",
          currentStock: 5,
          minThreshold: 20,
          maxThreshold: 100,
        },
        {
          id: "2",
          sku: "SKU-HD-002",
          name: "Winter Hoodie Basic",
          currentStock: 0,
          minThreshold: 15,
          maxThreshold: 80,
        },
        {
          id: "3",
          sku: "SKU-CP-003",
          name: "Denim Baseball Cap",
          currentStock: 150,
          minThreshold: 10,
          maxThreshold: 100,
        },
        {
          id: "4",
          sku: "SKU-SH-004",
          name: "Running Shoes X1",
          currentStock: 12,
          minThreshold: 15,
          maxThreshold: 50,
        },
      ]);

      setTableData([
        {
          id: "1",
          sku: "SKU-TS-001",
          name: "Premium Cotton T-Shirt",
          openingQty: 100,
          inward: 50,
          outward: 145,
          adjustments: 0,
          closingQty: 5,
          status: "Low Stock",
        },
        {
          id: "2",
          sku: "SKU-HD-002",
          name: "Winter Hoodie Basic",
          openingQty: 50,
          inward: 0,
          outward: 50,
          adjustments: 0,
          closingQty: 0,
          status: "Out of Stock",
        },
        {
          id: "3",
          sku: "SKU-CP-003",
          name: "Denim Baseball Cap",
          openingQty: 80,
          inward: 100,
          outward: 30,
          adjustments: 0,
          closingQty: 150,
          status: "Overstock",
        },
        {
          id: "4",
          sku: "SKU-SH-004",
          name: "Running Shoes X1",
          openingQty: 60,
          inward: 20,
          outward: 68,
          adjustments: 0,
          closingQty: 12,
          status: "Low Stock",
        },
        {
          id: "5",
          sku: "SKU-JK-005",
          name: "Leather Jacket Pro",
          openingQty: 30,
          inward: 10,
          outward: 5,
          adjustments: +2,
          closingQty: 37,
          status: "Safe",
        },
        {
          id: "6",
          sku: "SKU-SO-006",
          name: "Cotton Socks Pack",
          openingQty: 200,
          inward: 100,
          outward: 50,
          adjustments: -5,
          closingQty: 245,
          status: "Safe",
        },
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
      setStartDate(today);
      setEndDate(today);
      fetchDashboardData();
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
    fetchDashboardData();
  };

  // hàm đổi kho
  const handleWarehouseChange = (warehouse: string) => {
    setSelectedWarehouse(warehouse);
    fetchDashboardData();
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
  };
}
