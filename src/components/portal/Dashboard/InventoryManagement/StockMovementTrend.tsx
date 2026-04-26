import { useState, useEffect } from "react";
import "./StockMovementTrend.css";
import type { StockTrendData } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface StockMovementTrendProps {
  data: StockTrendData[];
}

export default function StockMovementTrend({ data }: StockMovementTrendProps) {
  const [displayCount, setDisplayCount] = useState(12);

  // resize listener
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640)
        setDisplayCount(5); // mobile
      else if (window.innerWidth < 1024)
        setDisplayCount(7); // tablet
      else setDisplayCount(12); // desktop
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!data || data.length === 0) return null;

  // slice data
  const visibleData = data.slice(-displayCount);
  const maxTotal = Math.max(...visibleData.map((d) => d.inward + d.outward));
  const yAxisValues = [
    maxTotal,
    Math.round(maxTotal * 0.75),
    Math.round(maxTotal * 0.5),
    Math.round(maxTotal * 0.25),
    0,
  ];

  return (
    <div className="smt-wrapper">
      {/* header */}
      <div className="smt-header">
        <h2 className="smt-title">Stock Movement Trend</h2>
      </div>

      {/* chart container */}
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

          {/* bars */}
          {visibleData.map((item, index) => {
            const safeMax = maxTotal > 0 ? maxTotal : 1;
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

                {/* bottom bar */}
                <div
                  className="smt-outward"
                  style={{ height: `${outwardHeight}%` }}
                />
                {/* top bar */}
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
