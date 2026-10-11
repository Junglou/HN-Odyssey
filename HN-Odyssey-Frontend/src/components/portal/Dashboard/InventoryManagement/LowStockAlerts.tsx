import "./LowStockAlerts.css";
import { AlertCircleIcon } from "../../../../assets/icons/InventoryManagementIcons";
import type { InventoryAlert } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface LowStockAlertsProps {
  alerts: InventoryAlert[];
  onActionClick?: (sku: string, type: "PO" | "TRANSFER") => void;
}

// Map trạng thái từ backend sang class CSS + nhãn hiển thị
const STATUS_META = {
  OUT_OF_STOCK: { cls: "out", label: "Out of Stock" },
  LOW_STOCK: { cls: "low", label: "Low Stock" },
  OVER_STOCK: { cls: "over", label: "Overstock" },
} as const;

export default function LowStockAlerts({
  alerts,
  onActionClick,
}: LowStockAlertsProps) {
  const hasAlerts = Array.isArray(alerts) && alerts.length > 0;

  return (
    <div className="lsa-wrapper">
      <h2 className="lsa-title">
        <AlertCircleIcon />
        Inventory Alerts
        {hasAlerts && <span className="lsa-count">{alerts.length}</span>}
      </h2>

      {!hasAlerts ? (
        // Empty state: luôn giữ khung, không return null nữa
        <div className="lsa-empty">All SKUs are at safe stock levels</div>
      ) : (
        <div className="lsa-list">
          {alerts.map((item) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.LOW_STOCK;
            const isOver = item.status === "OVER_STOCK";

            const fillPercent =
              item.status === "LOW_STOCK" && item.minThreshold > 0
                ? Math.min((item.currentStock / item.minThreshold) * 100, 100)
                : 100;

            return (
              <div className="lsa-item" key={item.id}>
                {/* name & status */}
                <div className="lsa-header">
                  <div className="lsa-name">{item.name}</div>
                  <span className={`lsa-tag ${meta.cls}`}>{meta.label}</span>
                </div>

                {/* sku */}
                <div className="lsa-sku-wrapper">
                  <span className="lsa-sku">{item.sku}</span>
                </div>

                {/* progress */}
                <div className="lsa-progress-bg">
                  <div
                    className={`lsa-progress-fill ${meta.cls}`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>

                {/* stock info & button */}
                <div className="lsa-footer">
                  <div className="lsa-stock-text">
                    {item.currentStock} Units (Min: {item.minThreshold} | Max:{" "}
                    {item.maxThreshold ?? "—"})
                  </div>

                  <button
                    className="lsa-action-btn"
                    onClick={() =>
                      onActionClick?.(item.sku, isOver ? "TRANSFER" : "PO")
                    }
                  >
                    {isOver ? "Điều chuyển" : "+ Tạo PO"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
