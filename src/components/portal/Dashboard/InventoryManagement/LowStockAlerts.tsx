import "./LowStockAlerts.css";
import { AlertCircleIcon } from "../../../../assets/icons/InventoryManagementIcons";
import type { InventoryAlert } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface LowStockAlertsProps {
  alerts: InventoryAlert[];
}

export default function LowStockAlerts({ alerts }: LowStockAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="lsa-wrapper">
      <h2 className="lsa-title">
        <AlertCircleIcon />
        Inventory Alerts
      </h2>

      <div className="lsa-list">
        {alerts.map((item) => {
          // status logic
          const isOut = item.currentStock === 0;
          const isOver = item.currentStock > item.maxThreshold;
          const isLow = !isOut && !isOver;

          let statusClass = "low";
          let statusText = "Low Stock";
          if (isOut) {
            statusClass = "out";
            statusText = "Out of Stock";
          }
          if (isOver) {
            statusClass = "over";
            statusText = "Overstock";
          }

          // progress logic
          const fillPercent = isLow
            ? Math.min((item.currentStock / item.minThreshold) * 100, 100)
            : 100;

          return (
            <div className="lsa-item" key={item.id}>
              {/* name & status */}
              <div className="lsa-header">
                <div className="lsa-name">{item.name}</div>
                <span className={`lsa-tag ${statusClass}`}>{statusText}</span>
              </div>

              {/* sku */}
              <div className="lsa-sku-wrapper">
                <span className="lsa-sku">{item.sku}</span>
              </div>

              {/* progress */}
              <div className="lsa-progress-bg">
                <div
                  className={`lsa-progress-fill ${statusClass}`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>

              {/* stock info & button */}
              <div className="lsa-footer">
                <div className="lsa-stock-text">
                  {item.currentStock} Units (Min: {item.minThreshold} | Max:{" "}
                  {item.maxThreshold})
                </div>

                <button className="lsa-action-btn">
                  {!isOver ? "+ Tạo PO" : "Điều chuyển"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
