import "./StockMovementTable.css";
import type { StockMovementRow } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";
import { getPageItems } from "../../../../utils/pagination";

interface StockMovementTableProps {
  data: StockMovementRow[];
  currentPage: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export default function StockMovementTable({
  data,
  currentPage,
  totalPages,
  isLoading = false,
  onPageChange,
}: StockMovementTableProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  const renderStatus = (status: string) => {
    let badgeClass = "safe";
    let displayText = status;

    if (status === "Out of Stock") {
      badgeClass = "critical";
      displayText = "Critical";
    } else if (status === "Low Stock") {
      badgeClass = "low";
    } else if (status === "Overstock") {
      badgeClass = "over";
    }

    return <span className={`smtab-badge ${badgeClass}`}>{displayText}</span>;
  };

  const renderAdjustment = (val: number) => {
    if (val > 0)
      return <span style={{ color: "#2563eb", fontWeight: 600 }}>+{val}</span>;
    if (val < 0)
      return <span style={{ color: "#ef4444", fontWeight: 600 }}>{val}</span>;
    return <span style={{ color: "#9ca3af" }}>0</span>;
  };

  return (
    <div className="smtab-wrapper">
      <div className="smtab-header">
        <h2 className="smtab-title">Stock Movement Details</h2>
      </div>

      <div className={`smtab-card ${isLoading ? "smtab-loading" : ""}`}>
        {!hasData ? (
          <div className="smtab-empty">
            No stock movement data for this period
          </div>
        ) : (
          <>
            <div className="smtab-container">
              <table className="smtab-table">
                <thead>
                  <tr>
                    <th className="smtab-th">SKU</th>
                    <th className="smtab-th">Product Name</th>
                    <th className="smtab-th">Opening Qty</th>
                    <th className="smtab-th">Inward</th>
                    <th className="smtab-th">Outward</th>
                    <th className="smtab-th">Adjustments</th>
                    <th className="smtab-th">Closing Qty</th>
                    <th className="smtab-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id}>
                      <td className="smtab-td" style={{ color: "#6b7280" }}>
                        {row.sku}
                      </td>
                      <td className="smtab-td" style={{ fontWeight: 600 }}>
                        {row.name}
                      </td>
                      <td className="smtab-td">{row.openingQty}</td>
                      <td
                        className="smtab-td"
                        style={{ color: "#10b981", fontWeight: 500 }}
                      >
                        +{row.inward}
                      </td>
                      <td
                        className="smtab-td"
                        style={{ color: "#ef4444", fontWeight: 500 }}
                      >
                        -{row.outward}
                      </td>
                      <td className="smtab-td">
                        {renderAdjustment(row.adjustments)}
                      </td>
                      <td className="smtab-td" style={{ fontWeight: 700 }}>
                        {row.closingQty}
                      </td>
                      <td className="smtab-td">{renderStatus(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="smtab-pagination">
                <button
                  className="smtab-btn"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => onPageChange(currentPage - 1)}
                >
                  Previous
                </button>

                {getPageItems(currentPage, totalPages).map((item, idx) =>
                  item === "..." ? (
                    <span key={`dots-${idx}`} className="smtab-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={`smtab-num ${item === currentPage ? "active" : ""}`}
                      disabled={isLoading}
                      onClick={() => onPageChange(item)}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  className="smtab-btn"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => onPageChange(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
