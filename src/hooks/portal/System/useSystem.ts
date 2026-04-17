import { useState, useEffect } from "react";

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

const MOCK_STATUS: SystemStatus = {
  overall: "Operational",
  uptime: "99.98%",
  activeIncidents: 2,
};

const MOCK_MINI_LATENCY: MetricDataPoint[] = [
  { time: "0", value: 40 },
  { time: "1", value: 30 },
  { time: "2", value: 80 },
  { time: "3", value: 160 },
  { time: "4", value: 50 },
  { time: "5", value: 40 },
  { time: "6", value: 60 },
];

const INITIAL_GAUGE_DATA = {
  cpu: { current: 45, peak: 62 },
  ram: { percent: 65, text: "5.2/8GB" },
  disk: { percent: 78, text: "390GB" },
};

const MOCK_PAGE_LOAD_DATA: MetricDataPoint[] = [
  { time: "0s", value: 100 },
  { time: "5s", value: 150 },
  { time: "10s", value: 600 },
  { time: "15s", value: 120 },
  { time: "20s", value: 300 },
  { time: "25s", value: 100 },
  { time: "30s", value: 150 },
];

const MOCK_INCIDENT_LOGS: IncidentLog[] = [
  {
    id: "1",
    time: "10:15 AM",
    severity: "Warning",
    component: "CPU",
    message: "Load > 60% Sustained",
  },
  {
    id: "2",
    time: "09:45 AM",
    severity: "Resolved",
    component: "Payment API",
    message: "Connection Restored",
  },
  {
    id: "3",
    time: "09:15 AM",
    severity: "Warning",
    component: "CPU",
    message: "Load > 65% Sustained",
  },
];

export function useSystem() {
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({
    overview: true,
    cpuRam: false,
    networkApi: false,
    paymentLogs: false,
    securityLogs: false,
  });

  // State cho Header Toolbars
  const [serverNode, setServerNode] = useState("Primary Node");
  const [timeframe, setTimeframe] = useState("Last Hour (Real-time)");
  const [refreshRate, setRefreshRate] = useState("30s");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // State cho Threshold Settings
  const [thresholds, setThresholds] = useState<Thresholds>({
    cpu: 90,
    ram: 90,
    disk: 85,
  });
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);

  // State cho Health Check Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State cho dữ liệu Real-time (Đồng hồ Gauge)
  const [gaugeData, setGaugeData] = useState(INITIAL_GAUGE_DATA);

  // Giả lập Real-time Update
  useEffect(() => {
    let intervalMs = 30000; // Mặc định 30s
    if (refreshRate === "10s") intervalMs = 10000;
    if (refreshRate === "5s") intervalMs = 5000;

    const timer = setInterval(() => {
      setGaugeData((prev) => ({
        ...prev,
        cpu: { ...prev.cpu, current: Math.floor(Math.random() * 20) + 40 }, // Ngẫu nhiên 40-60%
        ram: { ...prev.ram, percent: Math.floor(Math.random() * 10) + 60 }, // Ngẫu nhiên 60-70%
      }));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [refreshRate]);

  // Actions
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

  const runHealthCheck = () => {
    setToastMessage("Initiating full system health check... Please wait.");
    setTimeout(() => {
      setToastMessage("Health check completed. System is Operational.");
      setTimeout(() => setToastMessage(null), 3000); // Ẩn sau 3s
    }, 2000);
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
      status: MOCK_STATUS,
      miniLatency: MOCK_MINI_LATENCY,
      overview: {
        gauge: gaugeData,
        pageLoad: MOCK_PAGE_LOAD_DATA,
        logs: MOCK_INCIDENT_LOGS,
      },
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
