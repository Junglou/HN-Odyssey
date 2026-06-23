import { useState } from "react";
import "./RejectTradeInModal.css";

// props
interface RejectTradeInModalProps {
  isOpen: boolean;
  tradeInId: string | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => void;
}

// component
export default function RejectTradeInModal({
  isOpen,
  tradeInId,
  onClose,
  onConfirm,
}: RejectTradeInModalProps) {
  // states
  const [reason, setReason] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  // logic: reset state an toàn khi mở/đóng Modal
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setReason("");
    }
  }

  if (!isOpen || !tradeInId) return null;

  return (
    <div className="rtm-overlay">
      <div className="rtm-modal">
        <div className="rtm-header">
          <h3 className="rtm-title">Reject Trade-in Request</h3>
        </div>

        <div className="rtm-body">
          <div>
            <label className="rtm-label">
              Reason for Rejection <span className="rtm-required">*</span>
            </label>
            <textarea
              className="rtm-textarea"
              placeholder="Please specify why this trade-in is rejected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="rtm-footer">
          <button className="rtm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rtm-btn-confirm"
            disabled={!reason.trim()}
            onClick={() => onConfirm(tradeInId, reason)}
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}
