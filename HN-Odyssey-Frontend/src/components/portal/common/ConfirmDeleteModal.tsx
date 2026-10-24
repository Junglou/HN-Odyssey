import { useEffect } from "react";
import "./ConfirmDeleteModal.css";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  /** Mặc định "Delete Confirm" — các chỗ đang dùng không cần sửa gì */
  title?: string;
  /** Mặc định "Delete" */
  confirmLabel?: string;
  /** Mặc định "Cancel" */
  cancelLabel?: string;
}

const ConfirmDeleteModal = ({
  isOpen,
  message,
  onClose,
  onConfirm,
  title = "Delete Confirm",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: ConfirmDeleteModalProps) => {
  // Esc để đóng, giống các modal khác của Portal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ẩn modal nếu không được kích hoạt
  if (!isOpen) return null;

  // render
  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal-box" role="alertdialog" aria-modal="true">
        {/* Header chứa Tiêu đề và Nút X */}
        <div className="cd-modal-header">
          <h2 className="cd-modal-title">{title}</h2>
          <button
            className="cd-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
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

        {/* nội dung xác nhận */}
        <p className="cd-modal-message">{message}</p>

        {/* Khu vực nút bấm */}
        <div className="cd-modal-actions">
          <button className="cd-btn-cancel" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="cd-btn-delete" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
