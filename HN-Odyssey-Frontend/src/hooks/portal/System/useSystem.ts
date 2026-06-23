import { useState, useEffect, useCallback } from "react";
import axiosClient from "../../../api/axiosClient";

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
}

export interface Thresholds {
  cpu: number;
  ram: number;
  disk: number;
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

interface RawThirdPartyStatus {
  provider: string;
  status: string;
  avg_latency: number;
}

interface RawPaymentLog {
  _id: string;
  date: string;
  order_code: string;
  provider: string;
  error_type: string;
  error_message: string;
}

interface RawAggregatedSecurityLog {
  id: string;
  time: string;
  ip: string;
  target: string;
  attempts: number;
  status: string;
}

// 3. GIÁ TRỊ KHỞI TẠO MẶC ĐỊNH

const INITIAL_STATUS: SystemStatus = {
  overall: "Operational",
  uptime: "100%",
  activeIncidents: 0,
};

const INITIAL_GAUGE = {
  cpu: { current: 0, peak: 0 },
  ram: { percent: 0, text: "N/A" },
  disk: { percent: 0, text: "N/A" },
};

export function useSystem() {
  // State điều khiển UI giao diện
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({
    overview: true,
    cpuRam: false,
    networkApi: false,
    paymentLogs: false,
    securityLogs: false,
  });

  const [serverNode, setServerNode] = useState("Primary Node");
  const [timeframe, setTimeframe] = useState("Last Hour (Real-time)");
  const [refreshRate, setRefreshRate] = useState("30s");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [thresholds, setThresholds] = useState<Thresholds>({
    cpu: 90,
    ram: 90,
    disk: 85,
  });
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);

  // State lưu trữ dữ liệu thực từ API với kiểu dữ liệu chuẩn xác
  const [systemStatus, setSystemStatus] =
    useState<SystemStatus>(INITIAL_STATUS);
  const [gaugeData, setGaugeData] = useState(INITIAL_GAUGE);
  const [cpuHistory, setCpuHistory] = useState<MetricDataPoint[]>([]);
  const [ramHistory, setRamHistory] = useState<MetricDataPoint[]>([]);
  const [pageLoadData, setPageLoadData] = useState<MetricDataPoint[]>([]);
  const [networkData, setNetworkData] = useState<MetricDataPoint[]>([]);
  const [errorRateData, setErrorRateData] = useState<MetricDataPoint[]>([]);
  const [apiStatusList, setApiStatusList] = useState<ApiStatusItem[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogItem[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>([]);
  const [incidentLogs, setIncidentLogs] = useState<IncidentLog[]>([]);

  // Hàm gọi tổng hợp các API
  const fetchSystemData = useCallback(async () => {
    try {
      const params = {
        node: serverNode,
        timeframe: timeframe,
      };
      const responses = await Promise.allSettled([
        axiosClient.get("/admin/system-monitoring/status-widget", { params }),
        axiosClient.get("/admin/system-monitoring/resources-current", {
          params,
        }),
        axiosClient.get("/admin/system-monitoring/resources-history-24h", {
          params,
        }),
        axiosClient.get("/admin/system-monitoring/performance-history-24h", {
          params,
        }),
        axiosClient.get("/admin/system-monitoring/third-party-status", {
          params,
        }),
        axiosClient.get("/admin/system-monitoring/payment-errors", {
          params: { ...params, limit: 10 },
        }),
        // SỬA LỖI URL Ở ĐÂY: Dùng đúng endpoint của Monitoring thay vì /audit-logs
        axiosClient.get("/admin/system-monitoring/security-logs-recent", {
          params: { ...params, limit: 10 },
        }),
      ]);

      // 0. Widget Tổng quan
      if (
        responses[0].status === "fulfilled" &&
        responses[0].value.data?.data
      ) {
        const widgetData = responses[0].value.data.data;
        setSystemStatus({
          overall:
            widgetData.status === "RED"
              ? "Critical"
              : widgetData.status === "YELLOW"
                ? "Warning"
                : "Operational",
          uptime: widgetData.uptime || "100%",
          activeIncidents: widgetData.error_rate > 5 ? 1 : 0,
        });
      }

      // 1. Đồng hồ Gauge ổ cứng
      if (
        responses[1].status === "fulfilled" &&
        responses[1].value.data?.data
      ) {
        setGaugeData(responses[1].value.data.data);
      }

      // 2. Lịch sử CPU & RAM
      if (
        responses[2].status === "fulfilled" &&
        responses[2].value.data?.data
      ) {
        const historyData = responses[2].value.data.data;
        setCpuHistory(
          historyData.map((item: RawResourceHistory) => ({
            time: item.time,
            value: item.cpu,
          })),
        );
        setRamHistory(
          historyData.map((item: RawResourceHistory) => ({
            time: item.time,
            value: item.ram,
          })),
        );
      }

      // 3. API & Network
      if (
        responses[3].status === "fulfilled" &&
        responses[3].value.data?.data
      ) {
        const perfHistory = responses[3].value.data.data;
        setPageLoadData(
          perfHistory.map((item: RawPerformanceHistory) => ({
            time: item.hour,
            value: item.avg_latency,
          })),
        );
        setNetworkData(
          perfHistory.map((item: RawPerformanceHistory) => ({
            time: item.hour,
            value: item.avg_latency,
          })),
        );
        setErrorRateData(
          perfHistory.map((item: RawPerformanceHistory) => ({
            time: item.hour,
            value: item.error_rate,
          })),
        );
      }

      // 4. Đối tác thứ 3
      if (
        responses[4].status === "fulfilled" &&
        responses[4].value.data?.data
      ) {
        const thirdParty = responses[4].value.data.data;
        setApiStatusList(
          thirdParty.map((item: RawThirdPartyStatus, index: number) => ({
            id: index.toString(),
            service: item.provider,
            severity:
              item.status === "RED"
                ? "Critical"
                : item.status === "YELLOW"
                  ? "Warning"
                  : "Stable",
            avgLatency: `${item.avg_latency}ms`,
            lastCheck: "Vừa xong",
          })),
        );
      }

      // 5. Thanh toán
      if (
        responses[5].status === "fulfilled" &&
        responses[5].value.data?.data?.items
      ) {
        const payments = responses[5].value.data.data.items;
        setPaymentLogs(
          payments.map((item: RawPaymentLog) => ({
            id: item._id,
            time: new Date(item.date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
      }

      // 6. Security Logs đã Aggregate
      if (
        responses[6].status === "fulfilled" &&
        responses[6].value.data?.data
      ) {
        const logs = responses[6].value.data.data;
        setSecurityLogs(
          logs.map((item: RawAggregatedSecurityLog) => ({
            id: item.id,
            time: new Date(item.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            ip: item.ip,
            target: item.target,
            attempts: item.attempts,
            status: item.status,
          })),
        );

        // Map một phần vào log incident cho OverviewTab
        setIncidentLogs(
          logs.slice(0, 5).map((err: RawAggregatedSecurityLog) => ({
            id: err.id,
            time: new Date(err.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            severity: err.status === "IP Blocked" ? "Critical" : "Warning",
            component: "Security",
            message: `Truy cập bất thường từ ${err.ip} (${err.attempts} lần)`,
          })),
        );
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu giám sát hệ thống", error);
    }
  }, [serverNode, timeframe]);

  // Xử lý chu kỳ làm mới dữ liệu
  useEffect(() => {
    fetchSystemData();

    let intervalMs = 30000;
    if (refreshRate === "10s") intervalMs = 10000;
    if (refreshRate === "5s") intervalMs = 5000;

    const timer = setInterval(() => {
      fetchSystemData();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [refreshRate, fetchSystemData]);

  const toggleSection = (section: keyof VisibleSections) => {
    setVisibleSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown((prev) => (prev === dropdownName ? null : dropdownName));
  };

  const updateThreshold = (key: keyof Thresholds, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setThresholds((prev) => ({ ...prev, [key]: num }));
    }
  };

  const runHealthCheck = async () => {
    setToastMessage("Đang kiểm tra toàn diện hệ thống...");
    try {
      await axiosClient.get("/admin/system-monitoring/health");
      await fetchSystemData();
      setToastMessage("Hoàn tất kiểm tra. Hệ thống hoạt động ổn định.");
    } catch {
      // Đã loại bỏ biến error không sử dụng để tránh lỗi eslint no-unused-vars
      setToastMessage(
        "Hoàn tất kiểm tra. Phát hiện một số dịch vụ phản hồi chậm.",
      );
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return {
    state: {
      visibleSections,
      serverNode,
      timeframe,
      refreshRate,
      activeDropdown,
      thresholds,
      isEditingThresholds,
      toastMessage,
    },
    data: {
      status: systemStatus,
      miniLatency: networkData,
      overview: {
        gauge: gaugeData,
        pageLoad: pageLoadData,
        logs: incidentLogs,
      },
      cpuHistory,
      ramHistory,
      networkData,
      errorRateData,
      apiStatusList,
      paymentLogs,
      securityLogs,
    },
    actions: {
      toggleSection,
      setServerNode,
      setTimeframe,
      setRefreshRate,
      toggleDropdown,
      setIsEditingThresholds,
      updateThreshold,
      runHealthCheck,
    },
  };
}
