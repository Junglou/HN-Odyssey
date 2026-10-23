import { useState } from "react";
import "./CampaignPerformanceTable.css";
import PortalPagination from "../../common/Pagination/PortalPagination";
import { NO_SPEND_TOOLTIP } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

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

// Đồng bộ quy ước 3 màu với trang Marketing (US.82 AC3): lãi / hòa vốn / lỗ.
// Trước đây dùng roi.startsWith("+") → ROI 0% (hòa vốn) bị tô đỏ như lỗ.
const roiClass = (roi: string) => {
  if (roi === "—") return "cpt-roi-nospend";
  const v = parseFloat(roi);
  if (v > 0) return "cpt-roi-positive";
  if (v < 0) return "cpt-roi-negative";
  return "cpt-roi-breakeven";
};

export default function CampaignPerformanceTable({
  data,
}: CampaignPerformanceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Giữ an toàn cho biến data nhưng không ẩn component khi mảng rỗng
  const safeData = data || [];

  const totalPages = Math.ceil(safeData.length / itemsPerPage) || 1;
  // Dữ liệu ít đi (đổi filter) thì không để trang hiện tại vượt quá tổng số trang
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
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
                <th className="cpt-th">Spend (period)</th>
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
                    No campaigns with activity in this period
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
                        className={`cpt-roi-badge ${roiClass(row.roi)}`}
                        title={row.roi === "—" ? NO_SPEND_TOOLTIP : undefined}
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

        {safeData.length > 0 && (
          <div className="cpt-pagination-container">
            <PortalPagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
