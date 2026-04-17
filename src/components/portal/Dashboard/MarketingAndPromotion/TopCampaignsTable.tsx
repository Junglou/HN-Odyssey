import "./TopCampaignsTable.css";
import type { AdCampaign } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

interface TopCampaignsTableProps {
  campaigns: AdCampaign[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export default function TopCampaignsTable({
  campaigns,
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
}: TopCampaignsTableProps) {
  // check roi thực tế (>= 20%)
  const isGoodROI = (roiValue: string | number) => {
    if (!roiValue) return false;
    const numericValue = parseFloat(String(roiValue).replace("−", "-"));
    return numericValue >= 20;
  };

  return (
    <div className="tct-wrapper">
      <div className="tct-section-title">Top Performing Campaign</div>
      <div className="tct-table-wrapper">
        {!campaigns || campaigns.length === 0 ? (
          <div className="tct-empty-state">
            không có dữ liệu chiến dịch nào trong khoảng thời gian này
          </div>
        ) : (
          <>
            <table className="tct-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Status</th>
                  <th className="tct-col-right">Budget</th>
                  <th className="tct-col-right">Spend</th>
                  <th className="tct-col-right">Conversions</th>
                  <th className="tct-col-right">Revenue</th>
                  <th className="tct-col-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => (
                  <tr key={camp.id}>
                    <td>{camp.name}</td>
                    <td>
                      <span
                        className={`tct-status-badge ${
                          camp.status === "Running"
                            ? "tct-status-running"
                            : "tct-status-paused"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </td>
                    <td className="tct-col-right">{camp.budget}</td>
                    <td className="tct-col-right">{camp.spend}</td>
                    <td className="tct-col-right">{camp.conversions}</td>
                    <td className="tct-col-right">{camp.revenue}</td>
                    <td
                      className={`tct-col-right ${
                        isGoodROI(camp.roi) ? "tct-roi-positive" : ""
                      }`}
                    >
                      {camp.roi}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* phân trang */}
            <div className="tct-pagination-container">
              <button
                className="tct-page-nav-btn"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>

              <div className="tct-page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`tct-page-num-btn ${
                        currentPage === page ? "tct-active" : ""
                      }`}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>

              <button
                className="tct-page-nav-btn"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
