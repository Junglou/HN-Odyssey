import { useState } from "react";
import "./RevenueTrendAnalysis.css";
import type { TrendDataPoint } from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";

interface RevenueTrendAnalysisProps {
  trendData: TrendDataPoint[];
}

export default function RevenueTrendAnalysis({
  trendData,
}: RevenueTrendAnalysisProps) {
  // state cho tooltip động
  const [hoveredPoint, setHoveredPoint] = useState<TrendDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // xử lý trạng thái rỗng
  if (!trendData || trendData.length === 0) {
    return (
      <div className="rta-wrapper">
        <div className="rta-section-title">Revenue Trend Analysis</div>
        <div className="rta-empty-state">
          No revenue data available for the selected period.
        </div>
      </div>
    );
  }

  // kích thước khung vẽ
  const width = 1000;
  const height = 150;

  // tính chiều cao linh động cho biểu đồ
  const maxDataValue = Math.max(...trendData.map((d) => d.revenue));
  const maxRevenue = maxDataValue > 0 ? maxDataValue * 1.2 : 1000;

  // vẽ đường gấp khúc cho svg
  const generateLinePath = () => {
    const points = trendData.map((point, index) => {
      const x = (index / (trendData.length - 1)) * width;
      const y = height - (point.revenue / maxRevenue) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  // bắt tọa độ chuột để hiện tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * width;

    const segmentWidth = width / (trendData.length - 1);
    const index = Math.round(xRel / segmentWidth);
    const safeIndex = Math.max(0, Math.min(index, trendData.length - 1));

    const point = trendData[safeIndex];
    const pointX = (safeIndex / (trendData.length - 1)) * width;
    const pointY = height - (point.revenue / maxRevenue) * height;

    setHoveredPoint(point);
    setTooltipPos({
      x: (pointX / width) * 100,
      y: (pointY / height) * 100,
    });
  };

  return (
    <div className="rta-wrapper">
      <div className="rta-section-title">Revenue Trend Analysis</div>
      <div className="rta-container">
        <div className="rta-header-text">Revenue Trend Over Time</div>

        <div className="rta-svg-wrapper">
          {/* cột nhãn trục y */}
          <div className="rta-y-axis">
            <span>${(maxRevenue / 1000).toFixed(0)}K</span>
            <span>${((maxRevenue * 0.66) / 1000).toFixed(0)}K</span>
            <span>${((maxRevenue * 0.33) / 1000).toFixed(0)}K</span>
            <span>$0K</span>
          </div>

          <div className="rta-chart-area">
            {/* đường kẻ ngang */}
            <div className="rta-grid-lines">
              <div className="rta-grid-line"></div>
              <div className="rta-grid-line"></div>
              <div className="rta-grid-line"></div>
              <div className="rta-grid-line"></div>
            </div>

            <svg
              viewBox={`0 -10 ${width} 170`}
              className="rta-line-chart-svg"
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <path d={generateLinePath()} className="rta-chart-line" />

              {/* vẽ các điểm động */}
              {trendData.map((point, index) => {
                const x = (index / (trendData.length - 1)) * width;
                const y = height - (point.revenue / maxRevenue) * height;
                const isHovered = hoveredPoint?.date === point.date;

                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r={isHovered ? "6" : "3"}
                    fill={isHovered ? "#3b82f6" : "#64748b"}
                    style={{ transition: "all 0.2s ease" }}
                  />
                );
              })}
            </svg>

            {/* tooltip */}
            {hoveredPoint && (
              <div
                className="rta-dynamic-tooltip"
                style={{ left: `${tooltipPos.x}%`, top: `${tooltipPos.y}%` }}
              >
                {hoveredPoint.date}:{" "}
                <strong>${hoveredPoint.revenue.toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>

        {/* hàng nhãn trục x */}
        <div className="rta-x-axis">
          {trendData.map((d, i) => (
            <span key={i}>{d.date}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
