// Định nghĩa type chặt chẽ cho system stage
export interface SystemStage {
  id: string;
  type: string;
  title: string;
  desc: string;
  status: "active" | "offline";
}

export function useOverview() {
  const revenue = {
    total: "$132,400",
    trendValue: 15.2,
    history: [
      { time: "00:00", value: 100000 },
      { time: "06:00", value: 115000 },
      { time: "12:00", value: 105000 },
      { time: "18:00", value: 125000 },
      { time: "24:00", value: 132400 },
    ],
  };

  const pipeline = [
    { label: "Pending", value: 150, color: "#d4c5b6" },
    { label: "Pick/Pack", value: 315, color: "#e3d5c6" },
    { label: "Shipped", value: 850, color: "#fcf4cf" },
  ];

  const alerts = {
    lowStock: 18,
    openTickets: 18,
  };

  const inventoryBatches = [
    "Ready for Pick/Pack Batches",
    "Ready for Pick/Pack",
    "Ready for Pick/Eaties",
    "Ready for Pick/Cress",
  ];

  const inventoryHealth = [
    { name: "In stock", value: 92, fill: "#d4c5b6" },
    { name: "Low Stock", value: 8, fill: "#f1f5f9" },
  ];

  const recentTickets = [
    { id: "#TK-10020", status: "Open" },
    { id: "#TK-10021", status: "In Progress" },
    { id: "#TK-10022", status: "Closed" },
  ];

  const pendingReturns = [
    { name: "ORD-8821", status: "Pending", type: "warning" },
    { name: "ORD-8815", status: "Approved", type: "success" },
    { name: "ORD-8809", status: "Rejected", type: "error" },
  ];

  // data cố định 4 giai đoạn hệ thống
  const systemStages: SystemStage[] = [
    {
      id: "stage-1",
      type: "server",
      title: "Server Info",
      desc: "API Gateway Connected",
      status: "active",
    },
    {
      id: "stage-2",
      type: "order",
      title: "Order",
      desc: "Order Processing Online",
      status: "active",
    },
    {
      id: "stage-3",
      type: "announcement",
      title: "Announcement",
      desc: "Campaign Engine Down",
      status: "offline",
    },
    {
      id: "stage-4",
      type: "alert",
      title: "Alert",
      desc: "Security Monitoring Active",
      status: "active",
    },
  ];

  return {
    revenue,
    pipeline,
    alerts,
    inventoryBatches,
    inventoryHealth,
    recentTickets,
    pendingReturns,
    activities: systemStages,
  };
}
