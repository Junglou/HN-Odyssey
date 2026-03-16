import React from "react";
import "./ConfirmDeleteModal.css";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  message,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal-box">
        {/* Header chứa Tiêu đề và Nút X */}
        <div className="cd-modal-header">
          <h2 className="cd-modal-title">Delete Confirm</h2>
          <button className="cd-modal-close-btn" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Nội dung câu hỏi */}
        <p className="cd-modal-message">{message}</p>

        {/* Khu vực nút bấm */}
        <div className="cd-modal-actions">
          <button className="cd-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="cd-btn-delete" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
