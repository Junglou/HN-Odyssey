import { useState } from "react";
import "./CampaignPerformanceTable.css";

export interface CampaignData {
  id: string;
  name: string;
  status: "Active" | "Paused" | "Ended";
  budget: string;
  spend: string;
  revenue: string;
  roi: string;
}

interface CampaignPerformanceTableProps {
  data: CampaignData[];
}

export default function CampaignPerformanceTable({
  data,
}: CampaignPerformanceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Giữ an toàn cho biến data nhưng không ẩn component khi mảng rỗng
  const safeData = data || [];

  const totalPages = Math.ceil(safeData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = safeData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="cpt-wrapper">
      <div className="cpt-title">Campaign Performance Table</div>

      <div className="cpt-card">
        <div className="cpt-table-container">
          <table className="cpt-table">
            <thead>
              <tr>
                <th className="cpt-th">Campaign Name</th>
                <th className="cpt-th">Budget</th>
                <th className="cpt-th">Spend</th>
                <th className="cpt-th">Revenue</th>
                <th className="cpt-th">ROI %</th>
              </tr>
            </thead>
            <tbody>
              {safeData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="cpt-td"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#64748b",
                    }}
                  >
                    Không có chiến dịch quảng cáo nào phát sinh dữ liệu trong
                    thời gian này
                  </td>
                </tr>
              ) : (
                currentData.map((row) => (
                  <tr key={row.id} className="cpt-tr">
                    <td className="cpt-td" style={{ color: "#1e293b" }}>
                      {row.name}
                    </td>
                    <td className="cpt-td">{row.budget}</td>
                    <td className="cpt-td">{row.spend}</td>
                    <td className="cpt-td">{row.revenue}</td>
                    <td className="cpt-td">
                      <span
                        className={`cpt-roi-badge ${
                          row.roi.startsWith("+")
                            ? "cpt-roi-positive"
                            : "cpt-roi-negative"
                        }`}
                      >
                        {row.roi}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cpt-pagination-container">
          <button
            className="cpt-page-nav-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
          >
            Previous
          </button>

          <div className="cpt-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`cpt-page-num-btn ${currentPage === page ? "cpt-active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="cpt-page-nav-btn"
            disabled={currentPage === totalPages || safeData.length === 0}
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
