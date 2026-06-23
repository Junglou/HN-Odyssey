import { useState, useCallback, useEffect, useMemo } from "react";
import axiosClient from "../../../../api/axiosClient";

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

interface RawCampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  budget?: number;
  ad_spend: number;
  orders: number;
  allocated_revenue: number;
  roi_percent: number;
  profit_status: string;
}

interface RawCouponData {
  coupon_code: string;
  success_count: number;
  total_discount_cost: number;
  total_revenue: number;
  description: string;
}

const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

// Cấu hình số dòng trên 1 trang
const ITEMS_PER_PAGE = 5;

export function useMarketingAndPromotion() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
  };

  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>(
    formatDate(firstDayOfMonth),
  );
  const [endDate, setEndDate] = useState<string>(formatDate(today));

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const [adMetrics, setAdMetrics] = useState<AdOverviewMetrics>({
    totalAdSpend: "$0.00",
    adRevenue: "$0.00",
    totalConversions: "0",
    overallROI: "0%",
  });
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);

  const [couponMetrics, setCouponMetrics] = useState<CouponMetrics>({
    totalUsage: "0",
    totalDiscount: "$0.00",
    revenueGenerated: "$0.00",
  });
  const [coupons, setCoupons] = useState<CouponData[]>([]);

  // --- State Phân trang ---
  const [campaignPage, setCampaignPage] = useState<number>(1);
  const [couponPage, setCouponPage] = useState<number>(1);

  const validateDates = (start: string, end: string) => {
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

  const fetchMarketingData = useCallback(async (start: string, end: string) => {
    if (!validateDates(start, end)) return;
    setIsLoading(true);

    try {
      const queryParams = `?start_date=${start}T00:00:00.000Z&end_date=${end}T23:59:59.999Z`;

      const [campaignsRes, couponsRes] = await Promise.all([
        axiosClient.get(`/tracking/campaigns${queryParams}`),
        axiosClient.get(`/tracking/coupons${queryParams}`),
      ]);

      const rawCampaigns: RawCampaignData[] = campaignsRes.data?.data || [];
      const rawCoupons: RawCouponData[] = couponsRes.data?.data || [];

      let totalSpend = 0;
      let totalRev = 0;
      let totalConv = 0;

      const formattedCampaigns: AdCampaign[] = rawCampaigns.map(
        (camp: RawCampaignData) => {
          const spend = camp.ad_spend || 0;
          const rev = camp.allocated_revenue || 0;
          const conv = camp.orders || 0;

          totalSpend += spend;
          totalRev += rev;
          totalConv += conv;

          return {
            id: camp.campaign_id,
            name: camp.campaign_name,
            status:
              camp.status === "ACTIVE" ||
              camp.status === "Active" ||
              camp.status === "Running"
                ? "Running"
                : "Paused",
            budget: formatUSD(camp.budget || 0),
            spend: formatUSD(spend),
            conversions: conv,
            revenue: formatUSD(rev),
            roi: `${camp.roi_percent?.toFixed(2) || 0}%`,
            isPositiveROI: camp.profit_status === "PROFIT",
          };
        },
      );

      const netProfit = totalRev - totalSpend;
      const overallROI =
        totalSpend > 0
          ? (netProfit / totalSpend) * 100
          : netProfit > 0
            ? 100
            : 0;

      setAdMetrics({
        totalAdSpend: formatUSD(totalSpend),
        adRevenue: formatUSD(totalRev),
        totalConversions: formatNumber(totalConv),
        overallROI: `${overallROI.toFixed(2)}%`,
      });
      setCampaigns(formattedCampaigns);

      let totalUsage = 0;
      let totalDiscount = 0;
      let couponRev = 0;

      const formattedCoupons: CouponData[] = rawCoupons.map(
        (coup: RawCouponData) => {
          const usage = coup.success_count || 0;
          const discount = coup.total_discount_cost || 0;
          const rev = coup.total_revenue || 0;

          totalUsage += usage;
          totalDiscount += discount;
          couponRev += rev;

          return {
            id: coup.coupon_code,
            code: coup.coupon_code,
            description:
              coup.description || `Mã Khuyến Mãi: ${coup.coupon_code}`,
            usageCount: usage,
            totalDiscount: formatUSD(discount),
            revenueGenerated: formatUSD(rev),
          };
        },
      );

      setCouponMetrics({
        totalUsage: `${formatNumber(totalUsage)} Times`,
        totalDiscount: formatUSD(totalDiscount),
        revenueGenerated: formatUSD(couponRev),
      });
      setCoupons(formattedCoupons);

      // Reset phân trang về trang 1 khi filter/fetch data mới
      setCampaignPage(1);
      setCouponPage(1);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu Marketing:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketingData(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    const todayObj = new Date();

    let newStart = startDate;
    const newEnd = formatDate(todayObj);

    if (filter === "Today") {
      newStart = formatDate(todayObj);
    } else if (filter === "This Week") {
      const day = todayObj.getDay();
      const diff = todayObj.getDate() - day + (day === 0 ? -6 : 1);
      const firstDay = new Date(todayObj.setDate(diff));
      newStart = formatDate(firstDay);
    } else if (filter === "This Month") {
      const firstDay = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1);
      newStart = formatDate(firstDay);
    }

    setStartDate(newStart);
    setEndDate(newEnd);

    if (filter !== "Custom Range") {
      fetchMarketingData(newStart, newEnd);
    }
  };

  const handleApply = useCallback(() => {
    fetchMarketingData(startDate, endDate);
  }, [startDate, endDate, fetchMarketingData]);

  // --- Tính toán dữ liệu cắt trang ---
  const totalCampaignPages = Math.ceil(campaigns.length / ITEMS_PER_PAGE) || 1;
  const paginatedCampaigns = useMemo(() => {
    const startIdx = (campaignPage - 1) * ITEMS_PER_PAGE;
    return campaigns.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [campaigns, campaignPage]);

  const totalCouponPages = Math.ceil(coupons.length / ITEMS_PER_PAGE) || 1;
  const paginatedCoupons = useMemo(() => {
    const startIdx = (couponPage - 1) * ITEMS_PER_PAGE;
    return coupons.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [coupons, couponPage]);

  return {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    dateError,
    adMetrics,
    couponMetrics,
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
    // Trả về dữ liệu đã phân trang và handlers
    campaigns: paginatedCampaigns,
    campaignPage,
    totalCampaignPages,
    setCampaignPage,
    coupons: paginatedCoupons,
    couponPage,
    totalCouponPages,
    setCouponPage,
  };
}
