import "./StockMovementTrend.css";
import type { StockTrendData } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface StockMovementTrendProps {
  data: StockTrendData[];
}

export default function StockMovementTrend({ data }: StockMovementTrendProps) {
  // Báo rỗng nếu API không có dữ liệu giao dịch
  if (!data || data.length === 0) {
    return (
      <div className="smt-wrapper">
        <div className="smt-header">
          <h2 className="smt-title">Stock Movement Trend</h2>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: 200,
            color: "#64748b",
          }}
        >
          Không có dữ liệu giao dịch trong khoảng thời gian này
        </div>
      </div>
    );
  }

  // Tính giá trị trục Y lớn nhất từ TOÀN BỘ dữ liệu API
  const maxTotal = Math.max(...data.map((d) => d.inward + d.outward));
  const safeMax = maxTotal > 0 ? maxTotal : 1;

  const yAxisValues = [
    maxTotal,
    Math.round(maxTotal * 0.75),
    Math.round(maxTotal * 0.5),
    Math.round(maxTotal * 0.25),
    0,
  ];

  return (
    <div className="smt-wrapper">
      <div className="smt-header">
        <h2 className="smt-title">Stock Movement Trend</h2>
      </div>

      <div className="smt-chart-container">
        {/* y axis */}
        <div className="smt-y-axis">
          {yAxisValues.map((val, idx) => (
            <span key={idx}>{val}</span>
          ))}
        </div>

        {/* chart content */}
        <div className="smt-chart-content">
          {/* grid lines */}
          {yAxisValues.map((_, idx) => (
            <div
              key={`grid-${idx}`}
              className="smt-grid-line"
              style={{ top: `${(idx / 4) * 100}%` }}
            />
          ))}

          {/* Lặp qua TOÀN BỘ DATA để vẽ cột */}
          {data.map((item, index) => {
            const inwardHeight = (item.inward / safeMax) * 100;
            const outwardHeight = (item.outward / safeMax) * 100;

            return (
              <div className="smt-bar-group" key={index}>
                <div className="smt-tooltip">
                  <div style={{ marginBottom: 4 }}>
                    Inward: <strong>+{item.inward}</strong>
                  </div>
                  <div>
                    Outward: <strong>-{item.outward}</strong>
                  </div>
                </div>

                <div
                  className="smt-outward"
                  style={{ height: `${outwardHeight}%` }}
                />
                <div
                  className="smt-inward"
                  style={{ height: `${inwardHeight}%` }}
                />
                <div className="smt-label">{item.date}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div className="smt-legend">
        <div className="smt-legend-item">
          <div className="smt-dot" style={{ backgroundColor: "#e5d5c5" }} />
          Outward
        </div>
        <div className="smt-legend-item">
          <div className="smt-dot" style={{ backgroundColor: "#c6ac97" }} />
          Inward
        </div>
      </div>
    </div>
  );
}
