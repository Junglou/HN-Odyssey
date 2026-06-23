import "./CampaignROIAnalysis.css";

// Kiểu dữ liệu
export interface AdMetrics {
  totalSpend: string;
  totalRevenue: string;
  overallROI: string;
}

// Props
interface CampaignROIAnalysisProps {
  data: AdMetrics;
}

export default function CampaignROIAnalysis({
  data,
}: CampaignROIAnalysisProps) {
  // Validate
  if (!data) return null;

  return (
    <div className="croi-wrapper">
      <div className="croi-title">Campaign ROI Analysis</div>
      <div className="croi-grid">
        {/* Thẻ Spend */}
        <div className="croi-card">
          <div className="croi-icon-box">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div className="croi-info">
            <span className="croi-label">Total Spend</span>
            <span className="croi-value">{data.totalSpend}</span>
          </div>
        </div>

        {/* Thẻ Revenue */}
        <div className="croi-card">
          <div className="croi-icon-box">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="croi-info">
            <span className="croi-label">Total Revenue</span>
            <span className="croi-value">{data.totalRevenue}</span>
          </div>
        </div>

        {/* Thẻ ROI */}
        <div className="croi-card">
          <div className="croi-icon-box">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="croi-info">
            <span className="croi-label">Overall ROI</span>
            <span className="croi-value">{data.overallROI}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
