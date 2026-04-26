import { useState, useCallback } from "react";

// kiểu dữ liệu cho quảng cáo
export interface AdOverviewMetrics {
  totalAdSpend: string;
  adRevenue: string;
  totalConversions: string;
  overallROI: string;
}

export interface AdCampaign {
  id: string;
  name: string;
  status: "Running" | "Paused";
  budget: string;
  spend: string;
  conversions: number;
  revenue: string;
  roi: string;
  isPositiveROI: boolean;
}

// kiểu dữ liệu cho khuyến mãi
export interface CouponMetrics {
  totalUsage: string;
  totalDiscount: string;
  revenueGenerated: string;
}

export interface CouponData {
  id: string;
  code: string;
  description: string;
  usageCount: number;
  totalDiscount: string;
  revenueGenerated: string;
}

export function useMarketingAndPromotion() {
  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>("2024-05-01");
  const [endDate, setEndDate] = useState<string>("2024-05-31");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // dữ liệu mock quảng cáo
  const [adMetrics] = useState<AdOverviewMetrics>({
    totalAdSpend: "$50,000.00",
    adRevenue: "$120,000.00",
    totalConversions: "1,500",
    overallROI: "140%",
  });

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([
    {
      id: "c1",
      name: "Summer Sale FB Ads",
      status: "Paused",
      budget: "$20,000",
      spend: "$15,500",
      conversions: 600,
      revenue: "$45,000",
      roi: "190%",
      isPositiveROI: true,
    },
    {
      id: "c2",
      name: "Google Search - Sneakers",
      status: "Running",
      budget: "$30,000",
      spend: "$28,000",
      conversions: 800,
      revenue: "$70,000",
      roi: "150%",
      isPositiveROI: true,
    },
    {
      id: "c3",
      name: "Instagram Retargeting",
      status: "Running",
      budget: "$10,000",
      spend: "$6,500",
      conversions: 100,
      revenue: "$5,000",
      roi: "-23%",
      isPositiveROI: false,
    },
  ]);

  // dữ liệu mock mã giảm giá
  const [couponMetrics] = useState<CouponMetrics>({
    totalUsage: "2,850 Times",
    totalDiscount: "$35,600.00",
    revenueGenerated: "$210,500.00",
  });

  const [coupons, setCoupons] = useState<CouponData[]>([
    {
      id: "cp1",
      code: "SUMMER20",
      description: "20% off Summer Collection",
      usageCount: 1200,
      totalDiscount: "$18,000",
      revenueGenerated: "$90,000",
    },
    {
      id: "cp2",
      code: "WELCOME10",
      description: "10% off New Customer",
      usageCount: 950,
      totalDiscount: "$9,500",
      revenueGenerated: "$85,000",
    },
    {
      id: "cp3",
      code: "FREESHIP99",
      description: "Free Shipping on $99+",
      usageCount: 700,
      totalDiscount: "$8,100",
      revenueGenerated: "$35,500",
    },
  ]);

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

    setTimeout(() => {
      setCampaigns((prev) => [...prev].reverse());
      setCoupons((prev) => [...prev].reverse());
      setIsLoading(false);
    }, 800);
  }, [startDate, endDate]);

  return {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    dateError,
    adMetrics,
    campaigns,
    couponMetrics,
    coupons,
    handleFilterChange,
    setStartDate: (d: string) => {
      setStartDate(d);
      validateDates(d, endDate);
    },
    setEndDate: (d: string) => {
      setEndDate(d);
      validateDates(startDate, d);
    },
    handleApply,
  };
}
