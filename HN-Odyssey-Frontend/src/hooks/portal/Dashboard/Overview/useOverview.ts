import { useState, useEffect } from "react";
import axiosClient from "../../../../api/axiosClient";

export interface RevenueHistory {
  time: string;
  value: number;
}

export interface SystemStage {
  id: string;
  type: string;
  title: string;
  desc: string;
  status: "active" | "offline";
}

export interface PipelineItem {
  label: string;
  value: number;
  color: string;
}

export interface AlertData {
  lowStock: number;
  openTickets: number;
}

export interface InventoryHealthItem {
  name: string;
  value: number;
  fill: string;
}

export interface RecentTicketItem {
  id: string;
  status: string;
}

export interface PendingReturnItem {
  name: string;
  status: string;
  type: string;
}

export interface OverviewState {
  revenue: { total: string; trendValue: number; history: RevenueHistory[] };
  pipeline: PipelineItem[];
  alerts: AlertData;
  inventoryBatches: string[];
  inventoryHealth: InventoryHealthItem[];
  recentTickets: RecentTicketItem[];
  pendingReturns: PendingReturnItem[];
  activities: SystemStage[];
  isLoading: boolean;
}

interface BERevenueChart {
  label: string;
  revenue: number;
  orders: number;
}

interface BEPipelineStat {
  _id: string;
  count: number;
}

interface BEReturnStat {
  claim_code: string;
  status: string;
}

interface BERecentTicket {
  id: string;
  status: string;
}

interface BESystemActivity {
  id: string;
  type: string;
  title: string;
  desc: string;
  status: "active" | "offline";
}

interface BEOverviewMetrics {
  net_revenue: number;
  revenue_growth_percent: number;
  chart_data: BERevenueChart[];
  pipeline_stats: BEPipelineStat[];
  return_stats: BEReturnStat[];
  recent_tickets: BERecentTicket[];
  open_tickets_count: number;
  system_activities: BESystemActivity[];
  inventory_batches: string[]; // bổ sung để nhận danh sách phiếu xuất kho từ api
}

interface BEInventoryKPI {
  title: string;
  value: string;
  subtext: string;
  iconType: string;
}

// khởi tạo state tĩnh để block component không lỗi khi đang đợi fetch dữ liệu
const initialState: OverviewState = {
  revenue: { total: "$0", trendValue: 0, history: [] },
  pipeline: [],
  alerts: { lowStock: 0, openTickets: 0 },
  inventoryBatches: [],
  inventoryHealth: [],
  recentTickets: [],
  pendingReturns: [],
  activities: [],
  isLoading: true,
};

export function useOverview(): OverviewState {
  const [state, setState] = useState<OverviewState>(initialState);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [overviewRes, kpisRes] = await Promise.all([
          axiosClient.get("/reports/dashboard/overview?time_filter=TODAY"),
          axiosClient.get("/reports/dashboard/inventory-kpis"),
        ]);

        const overviewData = overviewRes.data.data as BEOverviewMetrics;
        const kpisData = kpisRes.data.data as BEInventoryKPI[];

        const revenue = {
          total: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(overviewData.net_revenue || 0),
          trendValue: overviewData.revenue_growth_percent || 0,
          history:
            overviewData.chart_data?.map((c) => ({
              time: c.label,
              value: c.revenue,
            })) || [],
        };

        const pipelineMap: Record<string, number> = {};
        overviewData.pipeline_stats?.forEach((stat) => {
          pipelineMap[stat._id] = stat.count;
        });

        // chuẩn hóa pipeline map chính xác với cấu trúc OrderStatus thực tế
        const pipeline: PipelineItem[] = [
          {
            label: "Pending",
            value:
              (pipelineMap["TEMPORARY"] || 0) +
              (pipelineMap["PENDING"] || 0) +
              (pipelineMap["ON_HOLD"] || 0),
            color: "#d4c5b6",
          },
          {
            label: "Pick/Pack",
            value:
              (pipelineMap["CONFIRMED"] || 0) +
              (pipelineMap["PROCESSING"] || 0) +
              (pipelineMap["READY_TO_SHIP"] || 0),
            color: "#e3d5c6",
          },
          {
            label: "Shipped",
            value:
              (pipelineMap["SHIPPING"] || 0) +
              (pipelineMap["DELIVERED"] || 0) +
              (pipelineMap["COMPLETED"] || 0),
            color: "#fcf4cf",
          },
        ];

        // Lấy KPI theo Số loại mã hàng (SKUs) thay vì tổng khối lượng
        const totalSkusItem = kpisData.find((k) => k.title === "Total SKUs");
        const lowStockItem = kpisData.find(
          (k) => k.title === "Low Stock Items",
        );

        // Mặc định là 1 để tránh lỗi chia cho 0 nếu kho chưa có dữ liệu
        const totalSkusCount = parseInt(
          totalSkusItem?.value?.replace(/,/g, "") || "1",
          10,
        );
        const lowStockCount = parseInt(lowStockItem?.value || "0", 10);

        // Tính % theo số lượng SKU
        const lowStockPercent =
          totalSkusCount > 0
            ? Math.round((lowStockCount / totalSkusCount) * 100)
            : 0;
        const inStockPercent = 100 - lowStockPercent;

        const inventoryHealth: InventoryHealthItem[] = [
          { name: "In stock", value: inStockPercent, fill: "#d4c5b6" },
          { name: "Low Stock", value: lowStockPercent, fill: "#f1f5f9" },
        ];

        const alerts: AlertData = {
          lowStock: lowStockCount,
          openTickets: overviewData.open_tickets_count || 0,
        };

        const recentTickets: RecentTicketItem[] = (
          overviewData.recent_tickets || []
        ).map((ticket) => {
          let uiStatus = "Open";
          if (ticket.status === "CLOSED") uiStatus = "Closed";
          if (ticket.status === "BOT") uiStatus = "Bot";
          return {
            id: `#TK-${ticket.id.toUpperCase()}`,
            status: uiStatus,
          };
        });

        const pendingReturns: PendingReturnItem[] = (
          overviewData.return_stats || []
        ).map((ret) => {
          let uiStatus = "Pending";
          let uiType = "warning";

          if (ret.status === "COMPLETED") {
            uiStatus = "Completed";
            uiType = "success";
          } else if (ret.status === "PROCESSING" || ret.status === "RECEIVED") {
            uiStatus = "In Progress";
            uiType = "success";
          }

          return {
            name: ret.claim_code || "N/A",
            status: uiStatus,
            type: uiType,
          };
        });

        setState({
          revenue,
          pipeline,
          alerts,
          // lấy trực tiếp danh sách lô hàng từ dữ liệu thực tế thay vì mock data
          inventoryBatches: overviewData.inventory_batches || [],
          inventoryHealth,
          recentTickets,
          pendingReturns,
          activities: overviewData.system_activities || [],
          isLoading: false,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard overview data:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchDashboardData();
  }, []);

  return state;
}
