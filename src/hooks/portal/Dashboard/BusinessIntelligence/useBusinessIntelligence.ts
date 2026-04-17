import { useState } from "react";

// định nghĩa kiểu dữ liệu
export interface KPI {
  value: string;
  trend: string;
  isPositive: boolean;
  isUp: boolean;
}

export interface BIMetrics {
  conversionRate: KPI;
  bounceRate: KPI;
  returningCustomerRate: KPI;
  totalSessions: KPI;
}

export interface TrendDataPoint {
  date: string;
  sessions: number;
  conversion: number;
}

export interface RetentionData {
  newVisitor: number;
  returningVisitor: number;
  newRevenue: string;
  returningRevenue: string;
}

export interface FunnelStage {
  stage: string;
  users: number;
  percentage: number;
  dropOff: string;
}

export interface AdMetrics {
  totalSpend: string;
  totalRevenue: string;
  overallROI: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: "Active" | "Paused" | "Ended";
  budget: string;
  spend: string;
  revenue: string;
  roi: string;
}

export function useBusinessIntelligence() {
  // lấy ngày hiện tại (YYYY-MM-DD)
  const today = new Date().toISOString().split("T")[0];

  // state bộ lọc
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // mock data
  const [metrics] = useState<BIMetrics>({
    conversionRate: {
      value: "2.5%",
      trend: "+0.5%",
      isPositive: true,
      isUp: true,
    },
    bounceRate: {
      value: "45.8%",
      trend: "-2.0%",
      isPositive: true,
      isUp: false,
    },
    returningCustomerRate: {
      value: "32%",
      trend: "+5.0%",
      isPositive: true,
      isUp: true,
    },
    totalSessions: {
      value: "150,500",
      trend: "+12%",
      isPositive: true,
      isUp: true,
    },
  });

  const [retentionData] = useState<RetentionData>({
    newVisitor: 78,
    returningVisitor: 22,
    newRevenue: "$500K",
    returningRevenue: "$800K",
  });

  const [trendData] = useState<TrendDataPoint[]>([
    { date: "May 1", sessions: 50000, conversion: 1.2 },
    { date: "May 5", sessions: 80000, conversion: 1.5 },
    { date: "May 10", sessions: 120000, conversion: 2.1 },
    { date: "May 15", sessions: 160000, conversion: 2.8 },
    { date: "May 17", sessions: 280000, conversion: 3.5 },
    { date: "May 19", sessions: 140000, conversion: 2.2 },
    { date: "May 21", sessions: 180000, conversion: 2.6 },
    { date: "May 24", sessions: 220000, conversion: 3.0 },
    { date: "May 28", sessions: 190000, conversion: 2.7 },
    { date: "May 30", sessions: 210000, conversion: 2.9 },
  ]);

  const [funnelData] = useState<FunnelStage[]>([
    { stage: "Sessions", users: 150500, percentage: 100, dropOff: "40%" },
    { stage: "View Product", users: 90300, percentage: 60, dropOff: "45%" },
    { stage: "Add to Cart", users: 22575, percentage: 15, dropOff: "7%" },
    {
      stage: "Initiate Checkout",
      users: 12040,
      percentage: 8,
      dropOff: "5.5%",
    },
    { stage: "Purchase", users: 3762, percentage: 2.5, dropOff: "0%" },
  ]);

  const [adMetrics] = useState<AdMetrics>({
    totalSpend: "$50,000.00",
    totalRevenue: "$120,000.00",
    overallROI: "140%",
  });

  const [campaigns] = useState<CampaignData[]>([
    {
      id: "1",
      name: "Summer Sale FB Ads",
      status: "Active",
      budget: "$20,000",
      spend: "$15,500",
      revenue: "$45,000",
      roi: "+190%",
    },
    {
      id: "2",
      name: "Google Search - Sneakers",
      status: "Active",
      budget: "$30,000",
      spend: "$28,000",
      revenue: "$70,000",
      roi: "+150%",
    },
    {
      id: "3",
      name: "Instagram Retargeting",
      status: "Ended",
      budget: "$10,000",
      spend: "$6,500",
      revenue: "$8,100",
      roi: "-23%",
    },
  ]);

  // logic xử lý
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setDateError(null);
    if (filter !== "Custom Range") {
      setStartDate(today);
      setEndDate(today);
      handleApply();
    }
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
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  };

  return {
    activeFilter,
    startDate,
    endDate,
    dateError,
    isLoading,
    metrics,
    trendData,
    retentionData,
    funnelData,
    adMetrics,
    campaigns,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
  };
}
