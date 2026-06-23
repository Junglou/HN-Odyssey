import { useState, useEffect, useCallback } from "react";
import axiosClient from "../../../../api/axiosClient";

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

// --- INTERFACES BE MỚI ---
interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface IConversionReport {
  overallConversionRate: number;
  conversionGrowth: number;
  isBelowKpi: boolean;
  targetKpi: number;
  funnel: Array<{ stepName: string; userCount: number; dropOffRate: number }>;
  trend: Array<{ label: string; rate: number; sessions?: number }>;
}

interface IBounceReport {
  total_visits: number;
  visitsGrowth: number;
  bounceRate: number;
  bounceGrowth: number;
}

interface IRetentionReport {
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  retentionGrowth: number;
  aovComparison: { newAov: number; returningAov: number };
}

interface ICampaignReport {
  campaign_id: string;
  campaign_name: string;
  status?: string;
  budget?: number;
  sessions: number;
  orders: number;
  conversion_rate: number;
  allocated_revenue: number;
  ad_spend: number;
  roi_percent: number;
  net_profit: number;
  profit_status: string;
}

export function useBusinessIntelligence() {
  // Lấy thời gian chuẩn theo Local của trình duyệt, không dùng múi giờ UTC
  const getLocalDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const now = new Date();
  const todayLocal = getLocalDateString(now);
  const startOfMonthLocal = getLocalDateString(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );

  // Khởi tạo state đúng chuẩn với bộ lọc "This Month"
  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>(startOfMonthLocal);
  const [endDate, setEndDate] = useState<string>(todayLocal);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [metrics, setMetrics] = useState<BIMetrics>({
    conversionRate: { value: "0%", trend: "0%", isPositive: true, isUp: true },
    bounceRate: { value: "0%", trend: "0%", isPositive: true, isUp: false },
    returningCustomerRate: {
      value: "0%",
      trend: "0%",
      isPositive: true,
      isUp: true,
    },
    totalSessions: { value: "0", trend: "0%", isPositive: true, isUp: true },
  });

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionData>({
    newVisitor: 0,
    returningVisitor: 0,
    newRevenue: "$0.00",
    returningRevenue: "$0.00",
  });
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [adMetrics, setAdMetrics] = useState<AdMetrics>({
    totalSpend: "$0.00",
    totalRevenue: "$0.00",
    overallROI: "0%",
  });
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);

  const mapTimeFilterToBE = (uiFilter: string): string => {
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

  // Tách hàm format ra dùng useCallback để tránh tạo mới liên tục
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  const fetchBIData = useCallback(async () => {
    if (activeFilter === "Custom Range" && !validateDates(startDate, endDate))
      return;

    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        time_filter: mapTimeFilterToBE(activeFilter),
        start_date: startDate,
        end_date: endDate,
      };

      const [conversionRes, bounceRes, retentionRes, campaignRes] =
        await Promise.allSettled([
          axiosClient.get<BaseResponse<IConversionReport>>(
            "/admin/reports/business/conversion",
            { params },
          ),
          axiosClient.get<BaseResponse<IBounceReport>>(
            "/admin/reports/business/behavior-abandonment",
            { params },
          ),
          axiosClient.get<BaseResponse<IRetentionReport>>(
            "/admin/reports/business/retention",
            { params },
          ),
          axiosClient.get<BaseResponse<ICampaignReport[]>>(
            "/tracking/campaigns",
            { params },
          ),
        ]);

      // 1. Conversion Data (Kiểm tra strict-type)
      if (conversionRes.status === "fulfilled") {
        const convData = conversionRes.value.data?.data;
        if (convData) {
          setMetrics((prev) => ({
            ...prev,
            conversionRate: {
              value: `${convData.overallConversionRate}%`,
              trend: `${convData.conversionGrowth > 0 ? "+" : ""}${convData.conversionGrowth}%`,
              isPositive: convData.conversionGrowth >= 0,
              isUp: convData.conversionGrowth >= 0,
            },
          }));

          if (convData.trend && convData.trend.length > 0) {
            setTrendData(
              convData.trend.map(
                (t: { label: string; rate: number; sessions?: number }) => ({
                  date: t.label,
                  sessions: t.sessions || 0,
                  conversion: t.rate,
                }),
              ),
            );
          } else {
            setTrendData([]);
          }

          if (convData.funnel && convData.funnel.length > 0) {
            const maxUsers = Math.max(
              ...convData.funnel.map(
                (f: {
                  stepName: string;
                  userCount: number;
                  dropOffRate: number;
                }) => f.userCount,
              ),
            );
            setFunnelData(
              convData.funnel.map(
                (f: {
                  stepName: string;
                  userCount: number;
                  dropOffRate: number;
                }) => ({
                  stage: f.stepName,
                  users: f.userCount,
                  percentage:
                    maxUsers > 0
                      ? Math.round((f.userCount / maxUsers) * 100)
                      : 0,
                  dropOff: `${f.dropOffRate}%`,
                }),
              ),
            );
          } else {
            setFunnelData([]);
          }
        }
      }

      // 2. Bounce Data
      if (bounceRes.status === "fulfilled") {
        const bounceData = bounceRes.value.data?.data;
        if (bounceData) {
          setMetrics((prev) => ({
            ...prev,
            bounceRate: {
              value: `${bounceData.bounceRate}%`,
              trend: `${bounceData.bounceGrowth > 0 ? "+" : ""}${bounceData.bounceGrowth}%`,
              isPositive: bounceData.bounceGrowth <= 0,
              isUp: bounceData.bounceGrowth > 0,
            },
            totalSessions: {
              value: bounceData.total_visits.toLocaleString("vi-VN"),
              trend: `${bounceData.visitsGrowth > 0 ? "+" : ""}${bounceData.visitsGrowth}%`,
              isPositive: bounceData.visitsGrowth >= 0,
              isUp: bounceData.visitsGrowth >= 0,
            },
          }));
        }
      }

      // 3. Retention Data
      if (retentionRes.status === "fulfilled") {
        const retData = retentionRes.value.data?.data;
        if (retData) {
          setMetrics((prev) => ({
            ...prev,
            returningCustomerRate: {
              value: `${retData.retentionRate}%`,
              trend: `${retData.retentionGrowth > 0 ? "+" : ""}${retData.retentionGrowth}%`,
              isPositive: retData.retentionGrowth >= 0,
              isUp: retData.retentionGrowth >= 0,
            },
          }));

          const totalCust = retData.newCustomers + retData.returningCustomers;
          const newPct =
            totalCust > 0
              ? Math.round((retData.newCustomers / totalCust) * 100)
              : 0;
          const retPct =
            totalCust > 0
              ? Math.round((retData.returningCustomers / totalCust) * 100)
              : 0;
          const newRevAmount =
            retData.newCustomers * retData.aovComparison.newAov;
          const retRevAmount =
            retData.returningCustomers * retData.aovComparison.returningAov;

          setRetentionData({
            newVisitor: newPct,
            returningVisitor: retPct,
            newRevenue: formatCurrency(newRevAmount),
            returningRevenue: formatCurrency(retRevAmount),
          });
        }
      }

      // 4. Campaign Data
      if (campaignRes.status === "fulfilled") {
        const campaignDataList = campaignRes.value.data?.data;
        if (campaignDataList && campaignDataList.length > 0) {
          const totalSpendVal = campaignDataList.reduce(
            (sum: number, c: ICampaignReport) => sum + (c.ad_spend || 0),
            0,
          );
          const totalRevVal = campaignDataList.reduce(
            (sum: number, c: ICampaignReport) =>
              sum + (c.allocated_revenue || 0),
            0,
          );
          const netProfitVal = totalRevVal - totalSpendVal;
          const overallRoiVal =
            totalSpendVal > 0
              ? (netProfitVal / totalSpendVal) * 100
              : netProfitVal > 0
                ? 100
                : 0;

          setAdMetrics({
            totalSpend: formatCurrency(totalSpendVal),
            totalRevenue: formatCurrency(totalRevVal),
            overallROI: `${overallRoiVal > 0 ? "+" : ""}${overallRoiVal.toFixed(2)}%`,
          });

          setCampaigns(
            campaignDataList.map((c: ICampaignReport) => ({
              id: c.campaign_id,
              name: c.campaign_name,
              status: (c.status as "Active" | "Paused" | "Ended") || "Active",
              budget: c.budget ? formatCurrency(c.budget) : "N/A",
              spend: formatCurrency(c.ad_spend),
              revenue: formatCurrency(c.allocated_revenue),
              roi: `${c.roi_percent > 0 ? "+" : ""}${c.roi_percent}%`,
            })),
          );
        } else {
          setAdMetrics({
            totalSpend: formatCurrency(0),
            totalRevenue: formatCurrency(0),
            overallROI: "0%",
          });
          setCampaigns([]);
        }
      } else {
        setAdMetrics({
          totalSpend: formatCurrency(0),
          totalRevenue: formatCurrency(0),
          overallROI: "0%",
        });
        setCampaigns([]);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu Business Intelligence:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, startDate, endDate, formatCurrency]);

  useEffect(() => {
    fetchBIData();
  }, [fetchBIData]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setDateError(null);

    const currentDate = new Date();

    if (filter === "Today") {
      const todayStr = getLocalDateString(currentDate);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filter === "This Week") {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(currentDate.setDate(diff));
      setStartDate(getLocalDateString(startOfWeek));
      setEndDate(getLocalDateString(new Date()));
    } else if (filter === "This Month") {
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      setStartDate(getLocalDateString(startOfMonth));
      setEndDate(getLocalDateString(new Date()));
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
    if (activeFilter === "Custom Range" && validateDates(startDate, endDate)) {
      fetchBIData();
    }
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
