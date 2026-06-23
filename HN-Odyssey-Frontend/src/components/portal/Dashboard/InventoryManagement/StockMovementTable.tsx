import { useState } from "react";
import "./StockMovementTable.css";
import type { StockMovementRow } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface StockMovementTableProps {
  data: StockMovementRow[];
}

export default function StockMovementTable({ data }: StockMovementTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  if (!data || data.length === 0) return null;

  // pagination
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = data.slice(startIndex, startIndex + itemsPerPage);

  // render status badge
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

  // render adjustments
  const renderAdjustment = (val: number) => {
    if (val > 0)
      return <span style={{ color: "#2563eb", fontWeight: 600 }}>+{val}</span>;
    if (val < 0)
      return <span style={{ color: "#ef4444", fontWeight: 600 }}>{val}</span>;
    return <span style={{ color: "#9ca3af" }}>0</span>;
  };

  return (
    <div className="smtab-wrapper">
      {/* header */}
      <div className="smtab-header">
        <h2 className="smtab-title">Stock Movement Details</h2>
      </div>

      {/* card */}
      <div className="smtab-card">
        {/* table */}
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
              {currentData.map((row) => (
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

        {/* pagination */}
        <div className="smtab-pagination">
          <button
            className="smtab-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`smtab-num ${currentPage === page ? "active" : ""}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}
          <button
            className="smtab-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
