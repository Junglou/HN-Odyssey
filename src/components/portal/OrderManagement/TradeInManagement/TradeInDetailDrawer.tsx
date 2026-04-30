import { useEffect } from "react";
import "./TradeInDetailDrawer.css";
import type { TradeInRow } from "../../../../hooks/portal/OrderManagement/TradeInManagement/useTradeInManagement";
import { TimelineCheckIcon } from "../../../../assets/icons/OrderManagementIcons";

// props
interface TradeInDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tradeInData: TradeInRow | null;
}

// component
export default function TradeInDetailDrawer({
  isOpen,
  onClose,
  tradeInData,
}: TradeInDetailDrawerProps) {
  // effects: standard modal behavior
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!tradeInData && isOpen) return null;

  return (
    <>
      {/* overlay */}
      <div
        className={`tim-drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      {/* drawer container */}
      <div className={`tim-drawer ${isOpen ? "open" : ""}`}>
        {tradeInData && (
          <>
            {/* header */}
            <div className="tim-drawer-header">
              <div className="tim-drawer-title-group">
                <h2 className="tim-drawer-title">{tradeInData.tradeInCode}</h2>
                <span
                  className={`tim-badge tim-badge-status-${tradeInData.status}`}
                >
                  {tradeInData.status}
                </span>
              </div>
              <button className="tim-btn-close" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* body */}
            <div className="tim-drawer-body">
              {/* column 1: customer & value info */}
              <div className="tim-col-info">
                <h3 className="tim-drawer-section-title">
                  Trade-in Information
                </h3>

                <div className="tim-info-list">
                  <div className="tim-info-row">
                    <span className="tim-info-label">Customer Name</span>
                    <span className="tim-info-value">
                      {tradeInData.customerName}
                    </span>
                  </div>
                  <div className="tim-info-row">
                    <span className="tim-info-label">Phone Number</span>
                    <span className="tim-info-value">
                      {tradeInData.customerPhone}
                    </span>
                  </div>
                  <div className="tim-info-row">
                    <span className="tim-info-label">Email</span>
                    <span className="tim-info-value">{tradeInData.email}</span>
                  </div>
                  <div className="tim-info-row">
                    <span className="tim-info-label">Request Date</span>
                    <span className="tim-info-value">
                      {new Date(tradeInData.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="tim-divider"></div>

                <div className="tim-info-list">
                  <div className="tim-info-row">
                    <span className="tim-info-label">Expected Value</span>
                    <span className="tim-info-value">
                      ${tradeInData.expectedValue.toLocaleString()}
                    </span>
                  </div>

                  {tradeInData.finalValue && (
                    <div className="tim-info-row tim-total-row">
                      <span className="tim-info-label-total">
                        Finalized Value
                      </span>
                      <span className="tim-info-value-total">
                        ${tradeInData.finalValue.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {tradeInData.payoutMethod && (
                    <div className="tim-info-row">
                      <span className="tim-info-label">Payout Method</span>
                      <span className="tim-info-value">
                        {tradeInData.payoutMethod}
                      </span>
                    </div>
                  )}
                </div>

                {tradeInData.note && (
                  <div className="tim-note-box">
                    <p className="tim-note-label">Staff Note:</p>
                    <p className="tim-note-text">{tradeInData.note}</p>
                  </div>
                )}
              </div>

              {/* column 2: device details */}
              <div className="tim-col-device">
                <h3 className="tim-drawer-section-title">Device Details</h3>
                <div className="tim-device-card">
                  <img
                    src={tradeInData.device.image}
                    alt={tradeInData.device.productName}
                    className="tim-device-img"
                  />
                  <div className="tim-device-details">
                    <p className="tim-device-name">
                      {tradeInData.device.productName}
                    </p>

                    <div className="tim-device-spec-row">
                      <span className="tim-device-label">Storage:</span>
                      <span className="tim-device-spec-text">
                        {tradeInData.device.storage}
                      </span>
                    </div>

                    <div className="tim-device-spec-row">
                      <span className="tim-device-label">Condition:</span>
                      <span className="tim-device-spec-text">
                        {tradeInData.device.condition}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* column 3: timeline */}
              <div className="tim-col-timeline">
                <h3 className="tim-drawer-section-title">Request Timeline</h3>
                <div className="tim-timeline">
                  {tradeInData.timeline.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "16px",
                      }}
                    >
                      No tracking records.
                    </div>
                  ) : (
                    tradeInData.timeline.map((step, idx) => (
                      <div
                        key={idx}
                        className={`tim-timeline-item ${step.isCompleted ? "completed" : ""}`}
                      >
                        <div className="tim-timeline-icon">
                          {step.isCompleted && <TimelineCheckIcon />}
                        </div>
                        <div className="tim-timeline-content">
                          <p className="tim-timeline-status">{step.status}</p>
                          {step.date && (
                            <p className="tim-timeline-date">
                              {new Date(step.date).toLocaleString()}
                            </p>
                          )}
                          <p className="tim-timeline-desc">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
