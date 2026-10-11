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

// ================= KIỂU DỮ LIỆU DÙNG CHO GIAO DIỆN =================

export interface AdOverviewMetrics {
  totalAdSpend: string;
  adRevenue: string;
  totalConversions: string;
  overallROI: string;
  isRoiAvailable: boolean; // false → kỳ lọc không có chi phí, ROI hiển thị "—"
}

// US.82 AC3: Xanh = lãi, Vàng = hòa vốn, Đỏ = lỗ. NO_SPEND = kỳ lọc không có chi phí (mục 7 #3)
export type ProfitStatus = "PROFIT" | "BREAK_EVEN" | "LOSS" | "NO_SPEND";

export interface AdCampaign {
  id: string;
  name: string;
  status: "Running" | "Paused" | "Completed";
  budget: string;
  budgetValue: number;
  spend: string; // chi phí TRONG KỲ lọc
  spendValue: number;
  lifetimeSpend: string; // tổng chi phí toàn thời gian
  lifetimeSpendValue: number;
  conversions: number;
  revenue: string;
  revenueValue: number;
  roi: string; // "12.50%" hoặc "—"
  roiValue: number | null;
  isPositiveROI: boolean;
  profitStatus: ProfitStatus;
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
  appliedCount: number; // số lần áp mã
  orderCount: number; // số đơn thành công
  totalDiscount: string;
  revenueGenerated: string;
  costRatio: string; // chi phí giảm giá / doanh thu
}

// US.79 AC5, US.82 AC4: hiệu quả gom theo kênh (utm_source)
export interface ChannelStat {
  channel: string;
  sessions: number;
  orders: number;
  revenue: number;
  spend: number;
  roi: number | null;
  profitStatus: ProfitStatus;
}

export interface CampaignOption {
  id: string;
  name: string;
}

// US.79 AC8, US.82 AC5: điểm dữ liệu xu hướng của 1 chiến dịch
export interface CampaignTrendPoint {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
  spend: number; // chi phí phân bổ cho ngày này
  cumulativeRevenue: number;
  cumulativeSpend: number;
  cumulativeRoi: number | null; // null khi từ đầu kỳ đến ngày này chưa có chi phí
}

// ---------- Ad Spend Ledger (US.82 AC1) ----------

export interface AdSpendActor {
  _id: string;
  name: string;
  email?: string;
}

export interface AdSpendEntry {
  entry_id: string;
  campaign_id: string;
  amount: number;
  period_start: string; // "YYYY-MM-DD"
  period_end: string;
  note?: string;
  created_by: AdSpendActor | null; // null = hệ thống (migration)
  created_at: string;
  is_voided: boolean;
  voided_by: AdSpendActor | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface AdSpendEntryList {
  campaign_id: string;
  lifetime_total: number;
  period_total: number | null;
  entries: AdSpendEntry[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

export interface NewAdSpendEntry {
  amount: number;
  period_start: string;
  period_end: string;
  note?: string;
}

export interface AppliedRange {
  start: string;
  end: string;
}

export interface AdSpendLedgerApi {
  range: AppliedRange;
  fetchEntries: (
    campaignId: string,
    page?: number,
  ) => Promise<AdSpendEntryList | null>;
  addEntry: (campaignId: string, payload: NewAdSpendEntry) => Promise<boolean>;
  voidEntry: (
    campaignId: string,
    entryId: string,
    reason: string,
  ) => Promise<boolean>;
}

// ================= KIỂU DỮ LIỆU TỪ BACKEND =================

interface RawCampaignData {
  campaign_id: string;
  campaign_name: string;
  status: string;
  budget?: number;
  utm?: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  sessions?: number;
  ad_spend: number; // chi phí trong kỳ
  ad_spend_total?: number; // tổng toàn thời gian
  orders: number;
  allocated_revenue: number;
  roi_percent: number | null;
  profit_status: string;
}

interface RawCouponData {
  coupon_code: string;
  description?: string;
  usage_count: number;
  success_count: number;
  total_revenue: number;
  total_discount_cost: number;
  cost_revenue_ratio: number;
}

interface RawCampaignTrend {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
  spend?: number;
}

interface ApiList<T> {
  data?: T[];
}

interface ApiItem<T> {
  data?: T;
}

// ================= HÀM THUẦN (NGOÀI HOOK) =================

const ITEMS_PER_PAGE = 5;
const AD_SPEND_PAGE_SIZE = 5;

export const NO_SPEND_TOOLTIP = "No ad spend in this period";

export const formatUSD = (amount: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const formatNumber = (num: number): string =>
  new Intl.NumberFormat("en-US").format(num);

const formatDate = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

// So sánh chuỗi YYYY-MM-DD vì new Date("YYYY-MM-DD") là 7h sáng giờ VN.
const getDateRangeError = (start: string, end: string): string | null => {
  if (!start || !end) return "Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc";
  if (start > end) return "Ngày bắt đầu không được lớn hơn ngày kết thúc";
  if (end > formatDate(new Date()))
    return "Không thể xem báo cáo cho ngày ở tương lai";
  return null;
};

const toQueryRange = (range: AppliedRange) => ({
  start_date: `${range.start}T00:00:00.000Z`,
  end_date: `${range.end}T23:59:59.999Z`,
});

export const roundMoney = (value: number): number =>
  Math.round(value * 100) / 100;

// Cùng công thức Backend (mục 3.5). Chi phí = 0 → null (UI hiển thị "—", mục 7 #3)
export const calcRoi = (revenue: number, spend: number): number | null =>
  spend > 0 ? ((revenue - spend) / spend) * 100 : null;

export const formatRoi = (roi: number | null): string =>
  roi === null ? "—" : `${roi.toFixed(2)}%`;

export const roiToStatus = (roi: number | null): ProfitStatus => {
  if (roi === null) return "NO_SPEND";
  if (roi > 0) return "PROFIT";
  if (roi < 0) return "LOSS";
  return "BREAK_EVEN";
};

const toProfitStatus = (value: string | undefined): ProfitStatus =>
  value === "PROFIT" || value === "LOSS" || value === "NO_SPEND"
    ? value
    : "BREAK_EVEN";

const toCampaignStatus = (value?: string): AdCampaign["status"] => {
  switch ((value || "").toUpperCase()) {
    case "PAUSED":
      return "Paused";
    case "COMPLETED":
      return "Completed";
    default:
      return "Running";
  }
};

const toAdCampaign = (camp: RawCampaignData): AdCampaign => {
  const spend = camp.ad_spend || 0;
  const lifetime = camp.ad_spend_total ?? spend;
  const rev = camp.allocated_revenue || 0;
  const roi = camp.roi_percent ?? null;
  return {
    id: camp.campaign_id,
    name: camp.campaign_name,
    status: toCampaignStatus(camp.status),
    budget: formatUSD(camp.budget || 0),
    budgetValue: camp.budget || 0,
    spend: formatUSD(spend),
    spendValue: spend,
    lifetimeSpend: formatUSD(lifetime),
    lifetimeSpendValue: lifetime,
    conversions: camp.orders || 0,
    revenue: formatUSD(rev),
    revenueValue: rev,
    roi: formatRoi(roi),
    roiValue: roi,
    isPositiveROI: camp.profit_status === "PROFIT",
    profitStatus: toProfitStatus(camp.profit_status),
  };
};

// US.79 AC5, US.82 AC4: gom chiến dịch theo kênh (utm_source) — chi phí trong kỳ
const buildChannelStats = (campaigns: RawCampaignData[]): ChannelStat[] => {
  const map = new Map<string, ChannelStat>();

  campaigns.forEach((c) => {
    const rawSource = c.utm?.utm_source?.trim() ?? "";
    const key = rawSource.toLowerCase() || "__unknown__";
    const label = rawSource
      ? rawSource.charAt(0).toUpperCase() + rawSource.slice(1)
      : "Unknown source";

    const stat = map.get(key) ?? {
      channel: label,
      sessions: 0,
      orders: 0,
      revenue: 0,
      spend: 0,
      roi: null,
      profitStatus: "NO_SPEND" as ProfitStatus,
    };
    stat.sessions += c.sessions || 0;
    stat.orders += c.orders || 0;
    stat.revenue += c.allocated_revenue || 0;
    stat.spend += c.ad_spend || 0;
    map.set(key, stat);
  });

  return Array.from(map.values())
    .map((s) => {
      const spend = roundMoney(s.spend);
      const raw = calcRoi(s.revenue, spend);
      const roi = raw === null ? null : Number(raw.toFixed(2));
      return { ...s, spend, roi, profitStatus: roiToStatus(roi) };
    })
    .sort((a, b) => b.revenue - a.revenue);
};

// US.79 AC8 + US.82 AC5: đủ mọi ngày trong kỳ.
// ROI lũy kế tại ngày d = (Σ doanh thu đầu kỳ → d − Σ chi phí đầu kỳ → d) ÷ Σ chi phí đầu kỳ → d × 100
const buildCampaignTrend = (
  raw: RawCampaignTrend[],
  range: AppliedRange,
): CampaignTrendPoint[] => {
  const byDate = new Map(raw.map((r) => [r.date, r]));
  let cumulativeRevenue = 0;
  let cumulativeSpend = 0;

  return listDatesBetween(range.start, range.end).map((date) => {
    const hit = byDate.get(date);
    const revenue = Number(hit?.revenue ?? 0);
    const spend = Number(hit?.spend ?? 0);
    cumulativeRevenue = roundMoney(cumulativeRevenue + revenue);
    cumulativeSpend = roundMoney(cumulativeSpend + spend);
    const roi = calcRoi(cumulativeRevenue, cumulativeSpend);
    return {
      date,
      sessions: Number(hit?.sessions ?? 0),
      orders: Number(hit?.orders ?? 0),
      revenue,
      spend,
      cumulativeRevenue,
      cumulativeSpend,
      cumulativeRoi: roi === null ? null : Number(roi.toFixed(2)),
    };
  });
};

// ================= HOOK =================

export function useMarketingAndPromotion() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [activeFilter, setActiveFilter] = useState<string>("This Month");
  const [startDate, setStartDate] = useState<string>(
    formatDate(firstDayOfMonth),
  );
  const [endDate, setEndDate] = useState<string>(formatDate(today));

  // Khoảng ngày ĐÃ ÁP DỤNG — Excel, biểu đồ, nhật ký chi phí đều theo khoảng này (US.95 AC3)
  const [appliedRange, setAppliedRange] = useState<AppliedRange>({
    start: formatDate(firstDayOfMonth),
    end: formatDate(today),
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [rawCampaigns, setRawCampaigns] = useState<RawCampaignData[]>([]);
  const [rawCoupons, setRawCoupons] = useState<RawCouponData[]>([]);
  const [campaignPage, setCampaignPage] = useState<number>(1);
  const [couponPage, setCouponPage] = useState<number>(1);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [trendState, setTrendState] = useState<{
    key: string;
    data: RawCampaignTrend[];
  }>({ key: "", data: [] });

  // Quyền chỉ dùng để ẩn/hiện nút — Backend vẫn kiểm tra lại
  const user = getCurrentUser();
  const canExport = hasPermission(
    user,
    Resource.REPORT_MARKETING,
    Action.EXPORT,
  );
  const canUpdate = hasPermission(
    user,
    Resource.REPORT_MARKETING,
    Action.UPDATE,
  );

  // ---------- DỮ LIỆU DẪN XUẤT ----------
  const allCampaigns = useMemo(
    () => rawCampaigns.map(toAdCampaign),
    [rawCampaigns],
  );

  // Tổng chi phí và Overall ROI theo KỲ LỌC (ad_spend từ BE là chi phí trong kỳ)
  const adMetrics = useMemo<AdOverviewMetrics>(() => {
    const totalSpend = roundMoney(
      rawCampaigns.reduce((s, c) => s + (c.ad_spend || 0), 0),
    );
    const totalRev = roundMoney(
      rawCampaigns.reduce((s, c) => s + (c.allocated_revenue || 0), 0),
    );
    const totalConv = rawCampaigns.reduce((s, c) => s + (c.orders || 0), 0);
    const roi = calcRoi(totalRev, totalSpend);
    return {
      totalAdSpend: formatUSD(totalSpend),
      adRevenue: formatUSD(totalRev),
      totalConversions: formatNumber(totalConv),
      overallROI: formatRoi(roi),
      isRoiAvailable: roi !== null,
    };
  }, [rawCampaigns]);

  const allCoupons = useMemo<CouponData[]>(
    () =>
      rawCoupons
        // Phòng thủ: bỏ mã không phát sinh (kể cả khi BE cũ còn trả về)
        .filter((c) => (c.usage_count || 0) > 0 || (c.success_count || 0) > 0)
        .sort(
          (a, b) =>
            (b.total_revenue || 0) - (a.total_revenue || 0) ||
            (b.success_count || 0) - (a.success_count || 0),
        )
        .map((coup) => ({
          id: coup.coupon_code,
          code: coup.coupon_code,
          description: coup.description || `Coupon ${coup.coupon_code}`,
          appliedCount: coup.usage_count || 0,
          orderCount: coup.success_count || 0,
          totalDiscount: formatUSD(coup.total_discount_cost || 0),
          revenueGenerated: formatUSD(coup.total_revenue || 0),
          costRatio: `${(coup.cost_revenue_ratio || 0).toFixed(2)}%`,
        })),
    [rawCoupons],
  );

  const couponMetrics = useMemo<CouponMetrics>(() => {
    const totalUsage = rawCoupons.reduce(
      (s, c) => s + (c.success_count || 0),
      0,
    );
    const totalDiscount = rawCoupons.reduce(
      (s, c) => s + (c.total_discount_cost || 0),
      0,
    );
    const couponRev = rawCoupons.reduce(
      (s, c) => s + (c.total_revenue || 0),
      0,
    );
    return {
      totalUsage: `${formatNumber(totalUsage)} ${totalUsage === 1 ? "Time" : "Times"}`,
      totalDiscount: formatUSD(totalDiscount),
      revenueGenerated: formatUSD(couponRev),
    };
  }, [rawCoupons]);

  const channelStats = useMemo(
    () => buildChannelStats(rawCampaigns),
    [rawCampaigns],
  );

  const campaignOptions = useMemo<CampaignOption[]>(
    () =>
      rawCampaigns.map((c) => ({ id: c.campaign_id, name: c.campaign_name })),
    [rawCampaigns],
  );

  // ---------- XU HƯỚNG CHIẾN DỊCH (US.79 AC8, US.82 AC5) ----------
  const trendKey = `${selectedCampaignId}|${appliedRange.start}|${appliedRange.end}`;

  useEffect(() => {
    if (!selectedCampaignId) return;
    let cancelled = false;

    void axiosClient
      .get<ApiList<RawCampaignTrend>>(
        `/tracking/campaigns/${selectedCampaignId}/trend`,
        { params: toQueryRange(appliedRange) },
      )
      .then((res) => {
        if (!cancelled) {
          setTrendState({ key: trendKey, data: res.data?.data ?? [] });
        }
      })
      .catch((error: unknown) => {
        console.error("Lỗi khi tải xu hướng chiến dịch:", error);
        if (!cancelled) setTrendState({ key: trendKey, data: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, appliedRange, trendKey]);

  const isTrendLoading =
    selectedCampaignId !== "" && trendState.key !== trendKey;

  const campaignTrend = useMemo(
    () =>
      !selectedCampaignId || isTrendLoading
        ? []
        : buildCampaignTrend(trendState.data, appliedRange),
    [selectedCampaignId, isTrendLoading, trendState.data, appliedRange],
  );

  // ---------- TẢI DỮ LIỆU ----------
  // keepPage = true: tải lại sau khi thêm/hủy chi phí, không nhảy về trang 1
  const fetchMarketingData = useCallback(
    async (start: string, end: string, keepPage = false) => {
      const rangeError = getDateRangeError(start, end);
      setDateError(rangeError);
      if (rangeError) return;

      setIsLoading(true);
      try {
        const params = toQueryRange({ start, end });
        const [campaignsRes, couponsRes] = await Promise.allSettled([
          axiosClient.get<ApiList<RawCampaignData>>("/tracking/campaigns", {
            params,
          }),
          axiosClient.get<ApiList<RawCouponData>>("/tracking/coupons", {
            params,
          }),
        ]);

        // Mỗi API độc lập: 1 cái lỗi/403 không làm mất dữ liệu cái còn lại
        const toList = <T>(
          res: PromiseSettledResult<{ data?: ApiList<T> }>,
          name: string,
        ): T[] => {
          if (res.status === "rejected") {
            console.warn(`${name} request failed:`, res.reason);
            return [];
          }
          const list = res.value.data?.data;
          return Array.isArray(list) ? list : [];
        };

        const nextCampaigns = toList<RawCampaignData>(
          campaignsRes,
          "campaigns",
        );
        setRawCampaigns(nextCampaigns);
        setRawCoupons(toList<RawCouponData>(couponsRes, "coupons"));
        setAppliedRange({ start, end });

        // Giữ chiến dịch đang chọn nếu vẫn còn; nếu không, chọn chiến dịch doanh thu cao nhất
        setSelectedCampaignId((prev) =>
          nextCampaigns.some((c) => c.campaign_id === prev)
            ? prev
            : (nextCampaigns[0]?.campaign_id ?? ""),
        );

        if (!keepPage) {
          setCampaignPage(1);
          setCouponPage(1);
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu Marketing:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchMarketingData(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- NHẬT KÝ CHI PHÍ QUẢNG CÁO (US.82 AC1) ----------
  const rangeStart = appliedRange.start;
  const rangeEnd = appliedRange.end;

  const fetchAdSpendEntries = useCallback(
    async (campaignId: string, page = 1): Promise<AdSpendEntryList | null> => {
      try {
        const res = await axiosClient.get<ApiItem<AdSpendEntryList>>(
          `/tracking/campaigns/${campaignId}/ad-spend`,
          {
            params: {
              ...toQueryRange({ start: rangeStart, end: rangeEnd }),
              page,
              limit: AD_SPEND_PAGE_SIZE,
            },
          },
        );
        return res.data?.data ?? null;
      } catch (error) {
        console.error(error);
        toast.error(
          await getExportErrorMessage(error, "Failed to load ad spend log."),
        );
        return null;
      }
    },
    [rangeStart, rangeEnd],
  );

  const addAdSpendEntry = async (
    campaignId: string,
    payload: NewAdSpendEntry,
  ): Promise<boolean> => {
    if (!canUpdate) {
      toast.error("You do not have permission to manage ad spend.");
      return false;
    }
    try {
      await axiosClient.post(
        `/tracking/campaigns/${campaignId}/ad-spend`,
        payload,
      );
      toast.success("Ad spend entry added.");
      void fetchMarketingData(rangeStart, rangeEnd, true);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        await getExportErrorMessage(error, "Failed to add ad spend entry."),
      );
      return false;
    }
  };

  const voidAdSpendEntry = async (
    campaignId: string,
    entryId: string,
    reason: string,
  ): Promise<boolean> => {
    if (!canUpdate) {
      toast.error("You do not have permission to manage ad spend.");
      return false;
    }
    try {
      await axiosClient.patch(
        `/tracking/campaigns/${campaignId}/ad-spend/${entryId}/void`,
        { reason },
      );
      toast.success("Ad spend entry voided.");
      void fetchMarketingData(rangeStart, rangeEnd, true);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        await getExportErrorMessage(error, "Failed to void ad spend entry."),
      );
      return false;
    }
  };

  const adSpendLedger: AdSpendLedgerApi = {
    range: appliedRange,
    fetchEntries: fetchAdSpendEntries,
    addEntry: addAdSpendEntry,
    voidEntry: voidAdSpendEntry,
  };

  // ---------- HÀNH ĐỘNG ----------
  // US.95 AC1, AC3: Excel theo khoảng ĐÃ ÁP DỤNG
  const handleExportExcel = async () => {
    if (!canExport) {
      toast.error("Bạn không có quyền xuất dữ liệu Excel.");
      return;
    }
    try {
      setIsExporting(true);
      const response = await axiosClient.get<Blob>(
        "/tracking/campaigns/export",
        { params: toQueryRange(appliedRange), responseType: "blob" },
      );
      const result = await saveBlobResponse(
        response,
        `MarketingReport_${formatDate(new Date()).replace(/-/g, "")}.xlsx`,
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

  // ---------- PHÂN TRANG ----------
  const totalCampaignPages =
    Math.ceil(allCampaigns.length / ITEMS_PER_PAGE) || 1;
  const paginatedCampaigns = useMemo(() => {
    const startIdx = (campaignPage - 1) * ITEMS_PER_PAGE;
    return allCampaigns.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [allCampaigns, campaignPage]);

  const totalCouponPages = Math.ceil(allCoupons.length / ITEMS_PER_PAGE) || 1;
  const paginatedCoupons = useMemo(() => {
    const startIdx = (couponPage - 1) * ITEMS_PER_PAGE;
    return allCoupons.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [allCoupons, couponPage]);

  return {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    dateError,
    isExporting,
    adMetrics,
    couponMetrics,
    period: formatPeriod(appliedRange.start, appliedRange.end),
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
    campaigns: paginatedCampaigns,
    campaignPage,
    totalCampaignPages,
    setCampaignPage,
    coupons: paginatedCoupons,
    couponPage,
    totalCouponPages,
    setCouponPage,
    channelStats,
    campaignOptions,
    selectedCampaignId,
    setSelectedCampaignId,
    campaignTrend,
    isTrendLoading,
    handleExportExcel,
    adSpendLedger,
    permissions: { canExport, canUpdate },
  };
}
