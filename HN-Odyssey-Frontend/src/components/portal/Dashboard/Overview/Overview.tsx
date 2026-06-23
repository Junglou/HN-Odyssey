import "./Overview.css";
import { AlertTriangleIcon } from "../../../../assets/icons/OverviewIcons";
import InventoryFulfillment from "./InventoryFulfillment";
import CrmReturns from "./CrmReturns";
import LiveActivityFeed from "./LiveActivityFeed";

interface RevenueHistory {
  time: string;
  value: number;
}

interface OverviewProps {
  revenue?: { total: string; trendValue?: number; history: RevenueHistory[] };
  pipeline?: { label: string; value: number; color: string }[];
  alerts?: { lowStock: number; openTickets: number };
  inventoryBatches?: string[];
  inventoryHealth?: { name: string; value: number; fill: string }[];
  recentTickets?: { id: string; status: string }[];
  pendingReturns?: { name: string; status: string; type: string }[];
  activities?: {
    id: string;
    type: string;
    title: string;
    desc: string;
    status: "active" | "offline";
  }[];
}

// hàm tính toán đường svg cho biểu đồ doanh thu
const generateWaveData = (history: RevenueHistory[]) => {
  if (!history || history.length <= 1) return { strokePath: "", fillPath: "" };
  const values = history.map((item) => item.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = history.map((item, i) => {
    const x = (i / (history.length - 1)) * 1440;
    const y = 80 - ((item.value - min) / range) * 50;
    return { x, y };
  });

  let path = `M${points[0].x},${points[0].y} `;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cx = (p1.x + p2.x) / 2;
    path += `C${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y} `;
  }
  return { strokePath: path, fillPath: `${path} L1440,200 L0,200 Z` };
};

export default function Overview({
  revenue,
  pipeline = [],
  alerts,
  inventoryBatches = [],
  inventoryHealth = [],
  recentTickets = [],
  pendingReturns = [],
  activities = [],
}: OverviewProps) {
  const trendValue = revenue?.trendValue ?? 0;
  const isTrendUp = trendValue >= 0;
  const { strokePath, fillPath } = generateWaveData(revenue?.history || []);

  return (
    <div className="ov-container">
      {/* phần chào mừng */}
      <div style={{ marginBottom: "4px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#1e293b",
          }}
        >
          Welcome back, Administrator
        </h1>
        <div
          style={{
            fontSize: "0.85rem",
            color: "#64748b",
            marginTop: "6px",
            fontWeight: 500,
          }}
        >
          System Status: Optimal{" "}
          <span style={{ color: "#22c55e", fontSize: "1rem" }}>●</span>
        </div>
      </div>

      <div className="ov-top-row">
        {/* thẻ doanh thu */}
        <div className="ov-card ov-revenue-card">
          <div className="ov-card-title">Revenue Velocity (Today)</div>
          <div className="ov-revenue-content">
            <div className="ov-revenue-amount">
              {revenue?.total || "$132,400"}
            </div>
            <div className="ov-revenue-subtitle">
              <span
                className={`ov-trend-text ${isTrendUp ? "ov-trend-up" : "ov-trend-down"}`}
              >
                {isTrendUp ? "+" : "-"}
                {Math.abs(trendValue)}%
              </span>
              &nbsp;vs yesterday trend
            </div>
          </div>
          <svg
            className="ov-wave-container"
            viewBox="0 0 1440 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="wave-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a38a70" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#fdfbf7" stopOpacity="0.0" />
              </linearGradient>
              <filter
                id="heat-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path d={fillPath} fill="url(#wave-gradient)" />
            <path
              className="ov-wave-line"
              d={strokePath}
              filter="url(#heat-glow)"
            />
          </svg>
        </div>

        {/* thẻ phễu vận hành */}
        <div className="ov-card">
          <div className="ov-card-title">Operational Pipeline</div>
          <div className="ov-pipeline-content">
            <div className="ov-pipeline-svg">
              <svg
                viewBox="0 0 100 100"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
              >
                <polygon points="0,0 100,0 75,40 25,40" fill="#c3aa95" />
                <polygon points="26,42 74,42 60,70 40,70" fill="#ebdcd0" />
                <polygon points="41,72 59,72 59,85 41,95" fill="#fdf8e7" />
              </svg>
            </div>
            <div className="ov-pipeline-stats">
              {pipeline.map((item, index) => (
                <div className="ov-stat-item" key={index}>
                  <div
                    className="ov-stat-dot"
                    style={{ background: item.color }}
                  ></div>
                  {item.label} ({item.value})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* thẻ cảnh báo */}
        <div className="ov-card ov-attention-card">
          <div className="ov-card-title">Attention Required</div>
          <div className="ov-alerts-wrapper">
            <div className="ov-alert-box">
              <div className="ov-alert-icon ov-icon-yellow">
                <AlertTriangleIcon width={20} height={20} />
              </div>
              <div>
                <span style={{ color: "#ca8a04", fontWeight: 700 }}>
                  {alerts?.lowStock ?? 18}
                </span>{" "}
                Low Stock SKUs
              </div>
            </div>
            <div className="ov-alert-divider"></div>
            <div className="ov-alert-box">
              <div className="ov-alert-icon ov-icon-red">
                <AlertTriangleIcon width={20} height={20} />
              </div>
              <div>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>
                  {alerts?.openTickets ?? 18}
                </span>{" "}
                Open Tickets
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ov-mid-row">
        <InventoryFulfillment
          batches={inventoryBatches}
          health={inventoryHealth}
        />
        <CrmReturns tickets={recentTickets} returns={pendingReturns} />
      </div>

      <LiveActivityFeed activities={activities} />
    </div>
  );
}
