import { useState, useRef, useLayoutEffect, useMemo } from "react";
import "./TrafficConversionTrend.css";
import type { TrendDataPoint } from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";

interface TrafficConversionTrendProps {
  data: TrendDataPoint[];
}

export default function TrafficConversionTrend({
  data,
}: TrafficConversionTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 320 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Lấy kích thước container thực tế
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({ width: entry.contentRect.width, height: 320 });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Tính toán thông số kỹ thuật và nhận diện biến động
  const chartConfig = useMemo(() => {
    if (!data || data.length === 0 || dimensions.width <= 1) return null;

    const padding = { top: 40, right: 60, bottom: 40, left: 60 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    const rawMaxS = Math.max(...data.map((d) => d.sessions));
    const niceMaxS = Math.ceil(rawMaxS / 40000) * 40000 || 40000;
    const rawMaxC = Math.max(...data.map((d) => d.conversion));
    const niceMaxC = Math.ceil(rawMaxC / 4) * 4 || 4;

    const steps = data.length > 1 ? data.length - 1 : 1;
    const getX = (idx: number) => padding.left + idx * (chartWidth / steps);
    const getYLeft = (v: number) =>
      padding.top + chartHeight - (v / niceMaxS) * chartHeight;
    const getYRight = (v: number) =>
      padding.top + chartHeight - (v / niceMaxC) * chartHeight;

    // Vẽ đường cong mượt
    let pathData = `M ${getX(0)},${getYRight(data[0].conversion)}`;
    for (let i = 1; i < data.length; i++) {
      const cx = (getX(i - 1) + getX(i)) / 2;
      pathData += ` C ${cx},${getYRight(data[i - 1].conversion)} ${cx},${getYRight(data[i].conversion)} ${getX(i)},${getYRight(data[i].conversion)}`;
    }

    // --- THUẬT TOÁN TÌM BIẾN ĐỘNG (DATA-DRIVEN LABELS) ---
    const significantIndices = new Set<number>();
    significantIndices.add(0); // Luôn hiện ngày đầu
    significantIndices.add(data.length - 1); // Luôn hiện ngày cuối

    // Tính mức độ biến động trung bình
    let totalDelta = 0;
    for (let i = 1; i < data.length; i++) {
      totalDelta += Math.abs(data[i].conversion - data[i - 1].conversion);
    }
    const avgDelta = totalDelta / (data.length || 1);

    // Tìm đỉnh, đáy và biến động mạnh
    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].conversion;
      const curr = data[i].conversion;
      const next = data[i + 1].conversion;

      const isPeak = curr > prev && curr >= next;
      const isTrough = curr < prev && curr <= next;
      const isBigJump = Math.abs(curr - prev) > avgDelta * 1.2;

      if (isPeak || isTrough || isBigJump) {
        significantIndices.add(i);
      }
    }

    // Lọc chống đè chữ (Giữ khoảng cách tối thiểu 45px giữa các nhãn)
    const sortedIndices = Array.from(significantIndices).sort((a, b) => a - b);
    const visibleLabels = new Set<number>();
    let lastAddedX = -100;

    for (const idx of sortedIndices) {
      const xPos = getX(idx);
      // Ngày cuối cùng bắt buộc phải hiện, các ngày khác phải cách nhau >= 45px
      if (idx === data.length - 1 || xPos - lastAddedX > 45) {
        visibleLabels.add(idx);
        lastAddedX = xPos;
      }
    }

    return {
      padding,
      chartWidth,
      chartHeight,
      niceMaxS,
      niceMaxC,
      getX,
      getYLeft,
      getYRight,
      pathData,
      visibleLabels,
    };
  }, [data, dimensions.width, dimensions.height]);

  const renderTooltip = () => {
    if (hoveredIndex === null || !chartConfig) return null;
    const item = data[hoveredIndex];
    const x = chartConfig.getX(hoveredIndex);
    const y = chartConfig.getYRight(item.conversion);
    const isTop = y < 90;

    return (
      <div
        className={`trend-tooltip ${isTop ? "flip-down" : ""}`}
        style={{ left: x, top: isTop ? y + 15 : y - 15 }}
      >
        <div className="trend-tooltip-date">{item.date}</div>
        <div className="trend-tooltip-row">
          <div className="trend-tooltip-label">
            <span className="trend-tooltip-dot sessions"></span> Sessions
          </div>
          <span className="trend-tooltip-value">
            {item.sessions.toLocaleString()}
          </span>
        </div>
        <div className="trend-tooltip-row">
          <div className="trend-tooltip-label">
            <span className="trend-tooltip-dot conversion"></span> Conversion
          </div>
          <span className="trend-tooltip-value">{item.conversion}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="trend-wrapper">
      <div className="trend-header">
        <div className="trend-title">Traffic & conversion Trend Over Time</div>
        <div className="trend-legend">
          <div className="trend-legend-item">
            <div className="trend-legend-color sessions"></div> Sessions (K)
          </div>
          <div className="trend-legend-item">
            <div className="trend-legend-color conversion"></div> Conversion (%)
          </div>
        </div>
      </div>

      <div
        className="trend-card"
        ref={containerRef}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {chartConfig && (
          <div className="trend-chart-container">
            <svg width={dimensions.width} height={dimensions.height}>
              {/* Lưới ngang */}
              {[0, 1, 2, 3, 4].map((t) => {
                const y =
                  chartConfig.padding.top +
                  chartConfig.chartHeight -
                  (t / 4) * chartConfig.chartHeight;
                return (
                  <g key={t}>
                    <line
                      x1={chartConfig.padding.left}
                      y1={y}
                      x2={dimensions.width - chartConfig.padding.right}
                      y2={y}
                      className="trend-grid-line"
                    />
                    <text
                      x={chartConfig.padding.left - 15}
                      y={y + 4}
                      textAnchor="end"
                      className="trend-axis-text"
                    >
                      {(((t / 4) * chartConfig.niceMaxS) / 1000).toFixed(0)}K
                    </text>
                    <text
                      x={dimensions.width - chartConfig.padding.right + 15}
                      y={y + 4}
                      textAnchor="start"
                      className="trend-axis-text"
                    >
                      {((t / 4) * chartConfig.niceMaxC).toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* Cột dữ liệu - Khóa cứng độ rộng tối đa 28px để luôn thanh mảnh */}
              {data.map((d, i) => {
                const x = chartConfig.getX(i);
                const y = chartConfig.getYLeft(d.sessions);
                const barW = Math.max(
                  8,
                  Math.min(28, (chartConfig.chartWidth / data.length) * 0.5),
                );
                return (
                  <rect
                    key={i}
                    x={x - barW / 2}
                    y={y}
                    width={barW}
                    height={
                      chartConfig.padding.top + chartConfig.chartHeight - y
                    }
                    className={`trend-bar ${hoveredIndex === i ? "is-hovered" : ""}`}
                  />
                );
              })}

              <path d={chartConfig.pathData} className="trend-line" />

              {/* Đường gióng dọc */}
              {hoveredIndex !== null && (
                <line
                  x1={chartConfig.getX(hoveredIndex)}
                  y1={chartConfig.padding.top}
                  x2={chartConfig.getX(hoveredIndex)}
                  y2={chartConfig.padding.top + chartConfig.chartHeight}
                  className="trend-hover-line"
                />
              )}

              {/* Interactive Layer & Labels dựa trên biến động */}
              {data.map((d, i) => {
                const x = chartConfig.getX(i);
                const y = chartConfig.getYRight(d.conversion);
                const step =
                  data.length > 1
                    ? chartConfig.chartWidth / (data.length - 1)
                    : chartConfig.chartWidth;
                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r={hoveredIndex === i ? 6 : 0}
                      className={`trend-point ${hoveredIndex === i ? "is-hovered" : ""}`}
                    />
                    <rect
                      x={x - step / 2}
                      y={0}
                      width={step}
                      height={dimensions.height}
                      fill="transparent"
                      onMouseMove={() => setHoveredIndex(i)}
                      style={{ cursor: "crosshair" }}
                    />

                    {/* Chỉ render text nếu index này nằm trong danh sách có biến động */}
                    {chartConfig.visibleLabels.has(i) && (
                      <text
                        x={x}
                        y={dimensions.height - 5}
                        textAnchor="middle"
                        className="trend-axis-text"
                      >
                        {d.date}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {renderTooltip()}
          </div>
        )}
      </div>
    </div>
  );
}
