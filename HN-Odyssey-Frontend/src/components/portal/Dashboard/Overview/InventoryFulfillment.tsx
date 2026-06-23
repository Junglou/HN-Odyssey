import "./InventoryFulfillment.css";

interface InventoryProps {
  batches: string[];
  health: { name: string; value: number; fill: string }[];
}

export default function InventoryFulfillment({
  batches,
  health,
}: InventoryProps) {
  // lấy dữ liệu tồn kho để tính phần trăm
  const inStockPercent =
    health?.find((h) => h.name === "In stock")?.value || 92;
  const lowStockPercent = 100 - inStockPercent;

  // thông số vẽ donut
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const gap = 5;

  // tính độ dài các đoạn vạch màu
  const inStockDash = Math.max(0, (inStockPercent / 100) * circumference - gap);
  const lowStockDash = Math.max(
    0,
    (lowStockPercent / 100) * circumference - gap,
  );

  // góc xoay để phần màu thứ 2 bắt nối tiếp màu thứ nhất
  const rotationAngle = (inStockPercent / 100) * 360;

  return (
    <div className="if-card">
      <div className="if-card-title">Inventory & Fulfillment</div>
      <div className="if-content">
        <div className="if-column">
          <div className="if-section-title">Ready for Pick/Pack Batches</div>
          <ul className="if-list">
            {batches?.map((batch, index) => (
              <li key={index}>{batch}</li>
            ))}
          </ul>
        </div>

        <div className="if-divider"></div>

        <div className="if-column">
          <div className="if-section-title">Inventory Health</div>
          <div className="if-donut-container">
            <svg
              width="150"
              height="150"
              viewBox="0 0 100 100"
              style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
            >
              {/* đoạn màu cho hàng còn trong kho */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#c3aa95"
                strokeWidth="16"
                strokeDasharray={`${inStockDash} ${circumference}`}
              />
              {/* đoạn màu cho hàng sắp hết */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#ebdcd0"
                strokeWidth="16"
                strokeDasharray={`${lowStockDash} ${circumference}`}
                transform={`rotate(${rotationAngle}, 50, 50)`}
              />
            </svg>

            <div className="if-stats">
              <div className="if-stat-item">
                <div
                  className="if-stat-dot"
                  style={{ background: "#c3aa95" }}
                ></div>
                In stock ({inStockPercent}%)
              </div>
              <div className="if-stat-item">
                <div
                  className="if-stat-dot"
                  style={{ background: "#ebdcd0" }}
                ></div>
                Low Stock ({lowStockPercent}%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
