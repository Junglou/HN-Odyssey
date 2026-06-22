import { useState, useRef, useEffect } from "react";
import "./UpdateStatusModal.css";
import type { OrderStatus } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import { ChevronDownSmallIcon } from "../../../../assets/icons/OrderManagementIcons";

interface UpdateStatusModalProps {
  isOpen: boolean;
  orderId: string | null;
  currentStatus: OrderStatus | null;
  onClose: () => void;
  // Đổi thành Promise để có thể await state loading
  onConfirm: (
    orderId: string,
    newStatus: OrderStatus,
    reason: string,
  ) => Promise<void>;
}

// CHỈ HIỂN THỊ 3 TRẠNG THÁI THEO ĐÚNG YÊU CẦU
const STATUS_LIST: OrderStatus[] = ["Delivered", "Cancelled", "Refunded"];

export default function UpdateStatusModal({
  isOpen,
  orderId,
  currentStatus,
  onClose,
  onConfirm,
}: UpdateStatusModalProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus>("Delivered");
  const [reason, setReason] = useState("");
  const [prevStatus, setPrevStatus] = useState<OrderStatus | null>(null);

  // State chống spam click
  const [isProcessing, setIsProcessing] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasDropdownOpened, setHasDropdownOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (currentStatus !== prevStatus) {
    setPrevStatus(currentStatus);
    // Nếu status cũ không nằm trong 3 cái trên, mặc định chọn Delivered
    setSelectedStatus(
      STATUS_LIST.includes(currentStatus as OrderStatus)
        ? (currentStatus as OrderStatus)
        : "Delivered",
    );
    setReason("");
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle Confirm Click
  const handleConfirmClick = async () => {
    if (!orderId || isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm(orderId, selectedStatus, reason);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !orderId) return null;

  return (
    <div className="usm-overlay">
      <div className="usm-modal">
        <div className="usm-header">
          <h3 className="usm-title">Update Order Status</h3>
        </div>

        <div className="usm-body">
          <div>
            <label className="usm-label">Select New Status</label>
            <div className="usm-custom-dropdown" ref={dropdownRef}>
              <div
                className={`usm-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  if (isProcessing) return;
                  setIsDropdownOpen(!isDropdownOpen);
                  if (!hasDropdownOpened) setHasDropdownOpened(true);
                }}
              >
                <span>{selectedStatus}</span>
                <div
                  className={`usm-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              <div
                className={`usm-dropdown-options ${isDropdownOpen ? "open" : hasDropdownOpened ? "closed" : ""}`}
              >
                {STATUS_LIST.map((status) => (
                  <div
                    key={status}
                    className={`usm-dropdown-option ${
                      selectedStatus === status ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedStatus(status);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {status}
                  </div>
                ))}
              </div>
            </div>

            <textarea
              className="usm-textarea"
              placeholder="Enter reason for update (Required)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isProcessing}
              autoFocus
            />
          </div>
        </div>

        <div className="usm-footer">
          <button
            className="usm-btn-cancel"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className="usm-btn-confirm"
            disabled={!reason.trim() || isProcessing}
            onClick={handleConfirmClick}
          >
            {isProcessing ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
