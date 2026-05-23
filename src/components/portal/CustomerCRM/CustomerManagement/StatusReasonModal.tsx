import { useState } from "react";
import "./StatusReasonModal.css";

export interface StatusReasonModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

// Wrapper Component: Chặn đứng việc giữ state cũ khi đóng/mở mà không dùng useEffect
export default function StatusReasonModal(props: StatusReasonModalProps) {
  if (!props.isOpen) return null;
  return <StatusReasonModalContent {...props} />;
}

function StatusReasonModalContent({
  title,
  description,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<StatusReasonModalProps, "isOpen">) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    onSubmit(reason.trim());
  };

  return (
    <div
      className="crm-reason-modal-overlay"
      onClick={!isSubmitting ? onClose : undefined}
    >
      <div
        className="crm-reason-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title + close btn */}
        <div className="crm-reason-model-header">
          <h3 className="crm-reason-model-title">{title}</h3>
          <button
            type="button"
            className="crm-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        {description && <p className="crm-reason-modal-desc">{description}</p>}

        {/* Label + Textarea */}
        <div className="crm-form-group crm-full-width">
          <label className="crm-reason-label">
            Reason for Action <span className="crm-reason-required">*</span>
          </label>
          <textarea
            className={`crm-reason-textarea ${error ? "error" : ""}`}
            placeholder="Enter detailed reason here..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            disabled={isSubmitting}
          />
          {error && <span className="crm-error-text">{error}</span>}
        </div>

        {/* Footer */}
        <div className="crm-reason-model-footer">
          <button
            type="button"
            className="crm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-submit-danger"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
