import { createPortal } from "react-dom";
import "./CartConfirmModal.css";

interface CartConfirmModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

const CartConfirmModal = ({
  isOpen,
  message,
  onClose,
  onConfirm,
}: CartConfirmModalProps) => {
  if (!isOpen) return null;

  const stopEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    stopEvent(e);
    onClose();
  };

  const handleConfirm = (e: React.MouseEvent) => {
    stopEvent(e);
    onConfirm();
  };

  return createPortal(
    <div
      className="cart-confirm-overlay"
      onMouseDown={stopEvent}
      onClick={stopEvent}
    >
      <div className="cart-confirm-box">
        <div className="cart-confirm-header">
          <h2 className="cart-confirm-title">Remove Item</h2>
          <button
            className="cart-confirm-close-btn"
            onClick={handleClose}
            onMouseDown={stopEvent}
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

        <p className="cart-confirm-message">{message}</p>

        <div className="cart-confirm-actions">
          <button
            className="cart-btn-cancel"
            onClick={handleClose}
            onMouseDown={stopEvent}
          >
            Cancel
          </button>
          <button
            className="cart-btn-confirm"
            onClick={handleConfirm}
            onMouseDown={stopEvent}
          >
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CartConfirmModal;
