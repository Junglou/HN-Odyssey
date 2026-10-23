import { useState } from "react";
import "./TopCampaignsTable.css";
import {
  NO_SPEND_TOOLTIP,
  type AdCampaign,
  type AdSpendLedgerApi,
} from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import PortalPagination from "../../common/Pagination/PortalPagination";
import ManageAdSpendDrawer from "./ManageAdSpendDrawer";

interface TopCampaignsTableProps {
  campaigns: AdCampaign[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  adSpendLedger?: AdSpendLedgerApi;
  canUpdate?: boolean;
}

// US.82 AC3: tên class theo trạng thái lợi nhuận
const ROI_CLASS: Record<AdCampaign["profitStatus"], string> = {
  PROFIT: "tct-roi-profit",
  BREAK_EVEN: "tct-roi-breakeven",
  LOSS: "tct-roi-loss",
  NO_SPEND: "tct-roi-nospend",
};

const STATUS_CLASS: Record<AdCampaign["status"], string> = {
  Running: "tct-status-running",
  Paused: "tct-status-paused",
  Completed: "tct-status-completed",
};

function LedgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

export default function TopCampaignsTable({
  campaigns,
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
  adSpendLedger,
  canUpdate = false,
}: TopCampaignsTableProps) {
  // Chiến dịch đang mở nhật ký (null = drawer đóng)
  const [openCampaign, setOpenCampaign] = useState<AdCampaign | null>(null);

  // Sau khi thêm/hủy, bảng được tải lại → lấy số liệu mới nhất thay vì giữ bản cũ
  const activeCampaign = openCampaign
    ? (campaigns.find((c) => c.id === openCampaign.id) ?? openCampaign)
    : null;

  // Người chỉ có quyền READ vẫn xem được nhật ký (báo cáo mục 5.2)
  const showActions = !!adSpendLedger;

  return (
    <div className="tct-wrapper">
      <div className="tct-section-title">Top Performing Campaign</div>
      <div className="tct-table-wrapper">
        {!campaigns || campaigns.length === 0 ? (
          <div className="tct-empty-state">
            No campaign data for this period.
          </div>
        ) : (
          <>
            <table className="tct-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Status</th>
                  <th className="tct-col-right">Budget</th>
                  <th className="tct-col-right">Spend (period)</th>
                  <th className="tct-col-right">Conversions</th>
                  <th className="tct-col-right">Revenue</th>
                  <th className="tct-col-right">ROI</th>
                  {showActions && <th className="tct-col-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => (
                  <tr key={camp.id}>
                    <td>{camp.name}</td>
                    <td>
                      <span
                        className={`tct-status-badge ${STATUS_CLASS[camp.status] ?? "tct-status-paused"}`}
                      >
                        {camp.status}
                      </span>
                    </td>
                    <td className="tct-col-right">{camp.budget}</td>

                    {/* Chi phí trong kỳ + dòng phụ tổng toàn thời gian */}
                    <td className="tct-col-right">
                      <div>{camp.spend}</div>
                      <div
                        className="tct-subvalue"
                        title="Total spend since the campaign started"
                      >
                        Lifetime: {camp.lifetimeSpend}
                      </div>
                    </td>

                    <td className="tct-col-right">{camp.conversions}</td>
                    <td className="tct-col-right">{camp.revenue}</td>

                    {/* US.82 AC3: Xanh lãi / Vàng hòa vốn / Đỏ lỗ / Xám không có chi phí */}
                    <td
                      className={`tct-col-right tct-roi ${ROI_CLASS[camp.profitStatus]}`}
                      title={
                        camp.profitStatus === "NO_SPEND"
                          ? NO_SPEND_TOOLTIP
                          : undefined
                      }
                    >
                      {camp.profitStatus === "LOSS" && (
                        <span
                          className="tct-roi-warning"
                          title="This campaign is losing money"
                        >
                          ⚠️
                        </span>
                      )}
                      {camp.roi}
                    </td>

                    {/* US.82 AC1: nhật ký chi phí */}
                    {showActions && (
                      <td className="tct-col-actions">
                        <button
                          type="button"
                          className="tct-action-btn"
                          onClick={() => setOpenCampaign(camp)}
                          aria-label={`${canUpdate ? "Manage" : "View"} ad spend for ${camp.name}`}
                        >
                          <LedgerIcon />
                          <span>
                            {canUpdate ? "Manage Spend" : "View Spend"}
                          </span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tct-pagination-container">
              <PortalPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          </>
        )}
      </div>

      {activeCampaign && adSpendLedger && (
        <ManageAdSpendDrawer
          key={activeCampaign.id}
          campaign={activeCampaign}
          ledger={adSpendLedger}
          canUpdate={canUpdate}
          onClose={() => setOpenCampaign(null)}
        />
      )}
    </div>
  );
}
