import "./ConversionFunnel.css";
// import icon từ file BI
import ChevronRightIcon from "../../../../assets/icons/BIIcons";
import type { FunnelStage } from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";

interface ConversionFunnelProps {
  data: FunnelStage[];
}

export default function ConversionFunnel({ data }: ConversionFunnelProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="funnel-wrapper">
      <div className="funnel-title">Conversion Funnel & Drop-offs</div>
      <div className="funnel-card">
        <div className="funnel-container">
          {data.map((stage, index) => {
            const widthPercent = 100 - index * 8;

            return (
              <div className="funnel-stage-wrapper" key={stage.stage}>
                <div
                  className="funnel-bar"
                  style={{ width: `${widthPercent}%` }}
                >
                  <div className="funnel-text-content">
                    <span className="funnel-label">{stage.stage}</span>
                    <span className="funnel-stats">
                      ({stage.users.toLocaleString()}) - {stage.percentage}%
                    </span>
                  </div>
                </div>

                {/* render rớt khách */}
                {index < data.length - 1 && (
                  <div className="funnel-dropoff">
                    <ChevronRightIcon /> Drop-off: {stage.dropOff}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
