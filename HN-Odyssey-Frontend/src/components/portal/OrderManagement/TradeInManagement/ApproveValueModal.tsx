import { useState } from "react";
import "./ApproveValueModal.css";

// props
interface ApproveValueModalProps {
  isOpen: boolean;
  tradeInId: string | null;
  onClose: () => void;
  onConfirm: (id: string, estimateValue: number, note: string) => void;
}

// component
export default function ApproveValueModal({
  isOpen,
  tradeInId,
  onClose,
  onConfirm,
}: ApproveValueModalProps) {
  // states
  const [estimateValue, setEstimateValue] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  // logic
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setEstimateValue("");
      setNote("");
    }
  }

  if (!isOpen || !tradeInId) return null;

  // validation
  const isFormValid =
    estimateValue !== "" && Number(estimateValue) > 0 && note.trim() !== "";

  // render
  return (
    <div className="avm-overlay">
      <div className="avm-modal">
        <div className="avm-header">
          <h3 className="avm-title">Approve Trade-in Request</h3>
        </div>

        <div className="avm-body">
          <div>
            <label className="avm-label">
              Estimated Value ($) <span className="avm-required">*</span>
            </label>
            <input
              type="number"
              className="avm-input"
              placeholder="Enter estimated value..."
              value={estimateValue}
              onChange={(e) => setEstimateValue(Number(e.target.value) || "")}
              autoFocus
              min="0"
            />
          </div>

          <div>
            <label className="avm-label">
              Approval Note <span className="avm-required">*</span>
            </label>
            <textarea
              className="avm-textarea"
              placeholder="Enter approval details or conditions..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="avm-footer">
          <button className="avm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="avm-btn-confirm"
            disabled={!isFormValid}
            onClick={() => onConfirm(tradeInId, Number(estimateValue), note)}
          >
            Confirm Approve
          </button>
        </div>
      </div>
    </div>
  );
}
