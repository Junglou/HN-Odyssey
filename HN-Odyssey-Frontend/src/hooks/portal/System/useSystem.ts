import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import type { UserProfile } from "../../../types/user";
import { Action, Resource } from "../../../types/permissions";
import { getCurrentUser, hasPermission } from "../../../utils/permission";
import { getApiErrorMessage, getApiErrorStatus } from "../../../utils/apiError";

// 1. CÁC INTERFACE GIAO TIẾP VỚI COMPONENT UI

export interface SystemStatus {
  overall: "Operational" | "Warning" | "Critical";
  uptime: string;
  activeIncidents: number;
}

export interface MetricDataPoint {
  time: string;
  value: number;
}

export interface IncidentLog {
  id: string;
  time: string;
  severity: "Warning" | "Resolved" | "Critical";
  component: string;
  message: string;
}

export interface VisibleSections {
  overview: boolean;
  cpuRam: boolean;
  networkApi: boolean;
  paymentLogs: boolean;
  securityLogs: boolean;
  auditLogs: boolean;
}

export interface Thresholds {
  cpu: number;
  ram: number;
  disk: number;
}

export interface GaugeData {
  cpu: { current: number; peak: number };
  ram: { percent: number; text: string };
  disk: { percent: number; text: string };
}

export interface ApiStatusItem {
  id: string;
  service: string;
  severity: string;
  avgLatency: string;
  lastCheck: string;
}

export interface PaymentLogItem {
  id: string;
  time: string;
  orderId: string;
  gateway: string;
  code: string;
  reason: string;
  status: string;
}

export interface SecurityLogItem {
  id: string;
  time: string;
  ip: string;
  target: string;
  attempts: number;
  status: string;
}

// 2. CÁC INTERFACE MAP DỮ LIỆU THÔ TỪ BACKEND

interface RawStatusWidget {
  status: "GREEN" | "YELLOW" | "RED";
  uptime: string;
}

interface RawResourceHistory {
  time: string;
  cpu: number;
  ram: number;
}

interface RawPerformanceHistory {
  hour: string;
  avg_latency: number;
  error_rate: number;
}

interface RawPerformanceStats {
  avg_latency_ms: number;
}

interface RawThirdPartyStatus {
  provider: string;
  status: string;
  avg_latency: number;
  last_check?: string;
}

interface RawPaymentLog {
  _id: string;
  date: string;
  order_code: string;
  provider: string;
  error_type: string;
  error_message: string;
}

interface RawPaymentResponse {
  items: RawPaymentLog[];
  meta?: { todayCount?: number };
}

interface RawAggregatedSecurityLog {
  id: string;
  time: string;
  ip: string;
  target: string;
  attempts: number;
  status: string;
}

interface RawIncident {
  id: string;
  time: string;
  severity: "Warning" | "Critical";
  component: string;
  message: string;
}

interface RawIncidentResponse {
  active_count: number;
  items: RawIncident[];
}

type ApiResult = PromiseSettledResult<{ data?: { data?: unknown } }>;

function pickData<T>(result: ApiResult): T | undefined {
  return result.status === "fulfilled"
    ? (result.value.data?.data as T | undefined)
    : undefined;
}

// 3. HẰNG SỐ & GIÁ TRỊ KHỞI TẠO

const API = "/admin/system-monitoring";

const REFRESH_INTERVAL_MS: Record<string, number> = {
  "5s": 5000,
  "10s": 10000,
  "30s": 30000,
};

const DEFAULT_THRESHOLDS: Thresholds = { cpu: 90, ram: 90, disk: 85 };

const INITIAL_STATUS: SystemStatus = {
  overall: "Operational",
  uptime: "100%",
  activeIncidents: 0,
};

const INITIAL_GAUGE: GaugeData = {
  cpu: { current: 0, peak: 0 },
  ram: { percent: 0, text: "N/A" },
  disk: { percent: 0, text: "N/A" },
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const mapOverall = (
  status: RawStatusWidget["status"],
): SystemStatus["overall"] =>
  status === "RED"
    ? "Critical"
    : status === "YELLOW"
      ? "Warning"
      : "Operational";

const isValidThreshold = (value: number) =>
  Number.isInteger(value) && value >= 1 && value <= 100;

// Giá trị đang gõ trong ô nhập, lưu dạng chuỗi để không hiện số 0 thừa ("090")
export type DraftThresholds = Record<keyof Thresholds, string>;

const toDraft = (values: Thresholds): DraftThresholds => ({
  cpu: String(values.cpu),
  ram: String(values.ram),
  disk: String(values.disk),
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  const msg = (error as { message?: unknown })?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  return fallback;
};

export function useSystem() {
  // Luôn đọc user qua tokenStorage (key "user_info"), không tự đọc localStorage
  const user = getCurrentUser<UserProfile>();
  const canViewSystem = hasPermission(
    user,
    Resource.SYSTEM_MONITORING,
    Action.READ,
  );
  const canUpdateThresholds = hasPermission(
    user,
    Resource.SYSTEM_MONITORING,
    Action.UPDATE,
  );
  const canViewAudit = hasPermission(user, Resource.SYSTEM_AUDIT, Action.READ);
  const canExportAudit = hasPermission(
    user,
    Resource.SYSTEM_AUDIT,
    Action.EXPORT,
  );

  // State điều khiển UI: user chỉ có quyền Audit thì mở sẵn tab Audit Logs
  const [visibleSections, setVisibleSections] = useState<VisibleSections>(
    () => ({
      overview: canViewSystem,
      cpuRam: false,
      networkApi: false,
      paymentLogs: false,
      securityLogs: false,
      auditLogs: !canViewSystem && canViewAudit,
    }),
  );
  const [timeframe, setTimeframe] = useState("Last Hour (Real-time)");
  const [refreshRate, setRefreshRate] = useState("30s");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Ngưỡng cảnh báo (lưu ở DB)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [draftThresholds, setDraftThresholds] = useState<DraftThresholds>(
    toDraft(DEFAULT_THRESHOLDS),
  );
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);

  // Dữ liệu thực từ API
  const [systemStatus, setSystemStatus] =
    useState<SystemStatus>(INITIAL_STATUS);
  const [gaugeData, setGaugeData] = useState<GaugeData>(INITIAL_GAUGE);
  const [cpuHistory, setCpuHistory] = useState<MetricDataPoint[]>([]);
  const [ramHistory, setRamHistory] = useState<MetricDataPoint[]>([]);
  const [latencyData, setLatencyData] = useState<MetricDataPoint[]>([]);
  const [errorRateData, setErrorRateData] = useState<MetricDataPoint[]>([]);
  const [apiStatusList, setApiStatusList] = useState<ApiStatusItem[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogItem[]>([]);
  const [failedPaymentsToday, setFailedPaymentsToday] = useState(0);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>([]);
  const [incidentLogs, setIncidentLogs] = useState<IncidentLog[]>([]);
  const [avgLatency, setAvgLatency] = useState(0);

  // Gọi tổng hợp các API (1 API lỗi không làm trống cả trang)
  const fetchSystemData = useCallback(async () => {
    if (!canViewSystem) return;
    const params = { timeframe };

    try {
      const responses = await Promise.allSettled([
        axiosClient.get(`${API}/status-widget`, { params }), // 0
        axiosClient.get(`${API}/resources-current`, { params }), // 1
        axiosClient.get(`${API}/resources-history-24h`, { params }), // 2
        axiosClient.get(`${API}/performance-history-24h`, { params }), // 3
        axiosClient.get(`${API}/third-party-status`, { params }), // 4
        axiosClient.get(`${API}/payment-errors`, {
          params: { ...params, limit: 10 },
        }), // 5
        axiosClient.get(`${API}/security-logs-recent`, { params }), // 6
        axiosClient.get(`${API}/incidents`, { params }), // 7
        axiosClient.get(`${API}/performance-stats`, { params }), // 8
      ]);

      // 0 + 7. KPI tổng quan
      const widget = pickData<RawStatusWidget>(responses[0]);
      const incidents = pickData<RawIncidentResponse>(responses[7]);
      if (widget || incidents) {
        setSystemStatus((prev) => ({
          overall: widget ? mapOverall(widget.status) : prev.overall,
          uptime: widget?.uptime ?? prev.uptime,
          activeIncidents: incidents?.active_count ?? prev.activeIncidents,
        }));
      }
      if (incidents) {
        setIncidentLogs(
          incidents.items.map((item) => ({
            id: item.id,
            time: formatTime(item.time),
            severity: item.severity,
            component: item.component,
            message: item.message,
          })),
        );
      }

      // 1. Gauge CPU / RAM / Disk
      const gauge = pickData<GaugeData>(responses[1]);
      if (gauge) setGaugeData(gauge);

      // 2. Lịch sử CPU & RAM
      const resourceHistory = pickData<RawResourceHistory[]>(responses[2]);
      if (resourceHistory) {
        setCpuHistory(
          resourceHistory.map((item) => ({ time: item.time, value: item.cpu })),
        );
        setRamHistory(
          resourceHistory.map((item) => ({ time: item.time, value: item.ram })),
        );
      }

      // 3. Thời gian phản hồi & tỷ lệ lỗi API
      const perfHistory = pickData<RawPerformanceHistory[]>(responses[3]);
      if (perfHistory) {
        setLatencyData(
          perfHistory.map((item) => ({
            time: item.hour,
            value: item.avg_latency,
          })),
        );
        setErrorRateData(
          perfHistory.map((item) => ({
            time: item.hour,
            value: item.error_rate,
          })),
        );
      }

      // 4. Đối tác thứ 3
      const thirdParty = pickData<RawThirdPartyStatus[]>(responses[4]);
      if (thirdParty) {
        setApiStatusList(
          thirdParty.map((item) => ({
            id: item.provider,
            service: item.provider,
            severity:
              item.status === "RED"
                ? "Critical"
                : item.status === "YELLOW"
                  ? "Warning"
                  : "Stable",
            avgLatency: `${item.avg_latency}ms`,
            lastCheck: item.last_check ? formatTime(item.last_check) : "—",
          })),
        );
      }

      // 5. Lỗi thanh toán
      const payments = pickData<RawPaymentResponse>(responses[5]);
      if (payments) {
        setPaymentLogs(
          payments.items.map((item) => ({
            id: item._id,
            time: formatTime(item.date),
            orderId: item.order_code,
            gateway: item.provider,
            code: item.error_type === "TECHNICAL_ERROR" ? "Tech" : "User",
            reason: item.error_message,
            status:
              item.error_type === "TECHNICAL_ERROR"
                ? "System Error"
                : "User Error",
          })),
        );
        setFailedPaymentsToday(payments.meta?.todayCount ?? 0);
      }

      // 6. Log bảo mật
      const security = pickData<RawAggregatedSecurityLog[]>(responses[6]);
      if (security) {
        setSecurityLogs(
          security.map((item) => ({
            id: item.id,
            time: formatTime(item.time),
            ip: item.ip,
            target: item.target,
            attempts: item.attempts,
            status: item.status,
          })),
        );
      }

      // 8. Độ trễ trung bình cho mini chart
      const perfStats = pickData<RawPerformanceStats>(responses[8]);
      if (perfStats) setAvgLatency(perfStats.avg_latency_ms);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu giám sát hệ thống", error);
    }
  }, [timeframe, canViewSystem]);

  // Tải ngưỡng cảnh báo 1 lần
  useEffect(() => {
    if (!canViewSystem) return;
    let ignore = false;
    axiosClient
      .get(`${API}/thresholds`)
      .then((res) => {
        const data = res.data?.data as Thresholds | undefined;
        if (!ignore && data) {
          setThresholds(data);
          setDraftThresholds(toDraft(data));
        }
      })
      .catch(() => {
        // Giữ ngưỡng mặc định nếu không tải được
      });
    return () => {
      ignore = true;
    };
  }, [canViewSystem]);

  // Chu kỳ làm mới dữ liệu
  useEffect(() => {
    void fetchSystemData();
    const timer = setInterval(
      () => void fetchSystemData(),
      REFRESH_INTERVAL_MS[refreshRate] ?? 30000,
    );
    return () => clearInterval(timer);
  }, [refreshRate, fetchSystemData]);

  const toggleSection = (section: keyof VisibleSections) => {
    setVisibleSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown((prev) => (prev === dropdownName ? null : dropdownName));
  };

  const startEditThresholds = () => {
    if (!canUpdateThresholds) return;
    setDraftThresholds(toDraft(thresholds));
    setIsEditingThresholds(true);
  };

  const cancelEditThresholds = () => {
    setDraftThresholds(toDraft(thresholds));
    setIsEditingThresholds(false);
  };

  const updateThresholdDraft = (key: keyof Thresholds, value: string) => {
    // Chỉ giữ chữ số, tối đa 3 ký tự, bỏ số 0 thừa ở đầu ("090" -> "90")
    const cleaned = value
      .replace(/\D/g, "")
      .slice(0, 3)
      .replace(/^0+(?=\d)/, "");
    setDraftThresholds((prev) => ({ ...prev, [key]: cleaned }));
  };

  const saveThresholds = async () => {
    if (!canUpdateThresholds) return;

    const payload: Thresholds = {
      cpu: Number(draftThresholds.cpu),
      ram: Number(draftThresholds.ram),
      disk: Number(draftThresholds.disk),
    };

    if (!Object.values(payload).every(isValidThreshold)) {
      toast.error("Ngưỡng cảnh báo phải là số nguyên từ 1 đến 100.");
      return;
    }

    setIsSavingThresholds(true);
    try {
      const res = await axiosClient.put(`${API}/thresholds`, payload);
      const saved = (res.data?.data as Thresholds | undefined) ?? payload;
      setThresholds(saved);
      setDraftThresholds(toDraft(saved));
      setIsEditingThresholds(false);
      toast.success("Đã lưu ngưỡng cảnh báo.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể lưu ngưỡng cảnh báo."));
    } finally {
      setIsSavingThresholds(false);
    }
  };

  const runHealthCheck = async () => {
    if (!canViewSystem) {
      toast.error("Bạn không có quyền xem giám sát hệ thống.");
      return;
    }
    setIsCheckingHealth(true);
    try {
      await axiosClient.get(`${API}/health`);
      await fetchSystemData();
      toast.success("Hoàn tất kiểm tra: Database và bộ nhớ hoạt động ổn định.");
    } catch (error) {
      // /health trả 503 khi có dịch vụ lỗi → đúng nghĩa "không ổn định".
      // Lỗi khác (không có quyền, mất mạng...) thì báo đúng nguyên nhân.
      if (getApiErrorStatus(error) === 503) {
        toast.warning(
          "Hoàn tất kiểm tra: phát hiện dịch vụ không ổn định (Database hoặc bộ nhớ).",
        );
      } else {
        toast.error(
          getApiErrorMessage(error, "Không thể chạy kiểm tra hệ thống."),
        );
      }
    } finally {
      setIsCheckingHealth(false);
    }
  };

  return {
    state: {
      visibleSections,
      timeframe,
      refreshRate,
      activeDropdown,
      thresholds,
      draftThresholds,
      isEditingThresholds,
      isSavingThresholds,
      isCheckingHealth,
      canUpdateThresholds,
      canViewMonitoring: canViewSystem,
      canViewAudit,
      canExportAudit,
    },
    data: {
      status: systemStatus,
      avgLatency,
      overview: {
        gauge: gaugeData,
        pageLoad: latencyData,
        logs: incidentLogs,
        thresholds,
      },
      cpuHistory,
      ramHistory,
      networkData: latencyData,
      errorRateData,
      apiStatusList,
      paymentLogs,
      failedPaymentsToday,
      securityLogs,
    },
    actions: {
      toggleSection,
      setTimeframe,
      setRefreshRate,
      toggleDropdown,
      startEditThresholds,
      cancelEditThresholds,
      updateThresholdDraft,
      saveThresholds,
      runHealthCheck,
    },
    permissions: { canViewSystem, canUpdateThresholds },
  };
}
