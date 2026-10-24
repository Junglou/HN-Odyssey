import { useState, useRef, useEffect } from "react";
import "./UpdateStatusModal.css";
import type { OrderStatus } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import { ChevronDownSmallIcon } from "../../../../assets/icons/OrderManagementIcons";

interface UpdateStatusModalProps {
  isOpen: boolean;
  orderId: string | null;
  currentStatus: OrderStatus | null;
  /** Trạng thái gốc của BE (VD: SHIPPING, PROCESSING) — dùng để lọc bước hợp lệ */
  rawStatus: string | null;
  /** Chỉ Ban giám đốc / Super Admin — backend xác nhận qua /orders/meta/can-override */
  canOverride: boolean;
  onClose: () => void;
  onConfirm: (
    orderId: string,
    newStatus: OrderStatus,
    reason: string,
    force: boolean,
  ) => Promise<void>;
}

type ModalStatus = "Delivered" | "Cancelled" | "Refunded";
const STATUS_LIST: ModalStatus[] = ["Delivered", "Cancelled", "Refunded"];

// Đồng bộ với order-state-machine.service.ts (BE): đơn đang ở trạng thái gốc nào
// thì được chọn bước này khi KHÔNG ép trạng thái. Chỉ để lọc giao diện,
// backend vẫn là nơi kiểm tra cuối cùng.
const ALLOWED_FROM: Record<ModalStatus, string[]> = {
  Delivered: ["SHIPPING"],
  Cancelled: [
    "PENDING",
    "PRIORITY",
    "TRADE_IN_REVIEW",
    "CONFIRMED",
    "ON_HOLD",
    "PROCESSING",
    "READY_TO_SHIP",
    "DELIVERY_FAILED",
    "REFUND_NEEDED",
    "REFUND_PENDING",
  ],
  // "Refunded" trên giao diện = RETURNED ở backend
  Refunded: ["SHIPPING", "DELIVERED", "DELIVERY_FAILED"],
};

export default function UpdateStatusModal({
  isOpen,
  orderId,
  rawStatus,
  canOverride,
  onClose,
  onConfirm,
}: UpdateStatusModalProps) {
  const [force, setForce] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ModalStatus | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasDropdownOpened, setHasDropdownOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isForcing = force && canOverride;

  // Không Force: chỉ các bước hợp lệ theo quy trình. Có Force: cả 3 lựa chọn.
  const options = isForcing
    ? STATUS_LIST
    : STATUS_LIST.filter(
        (s) => rawStatus !== null && ALLOWED_FROM[s].includes(rawStatus),
      );

  // Lựa chọn cũ không còn hợp lệ (vd. vừa bỏ tick Force) → tự về lựa chọn hợp lệ đầu tiên
  const effectiveStatus =
    selectedStatus && options.includes(selectedStatus)
      ? selectedStatus
      : (options[0] ?? null);

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

  const handleConfirmClick = async () => {
    if (!orderId || !effectiveStatus || isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm(orderId, effectiveStatus, reason, isForcing);
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

            {options.length === 0 ? (
              <p className="usm-empty">
                No valid next step from the current status.{" "}
                {canOverride
                  ? "Tick Force below to override the workflow."
                  : "Ask a Board member if this order needs a manual change."}
              </p>
            ) : (
              <div className="usm-custom-dropdown" ref={dropdownRef}>
                <div
                  className={`usm-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    if (isProcessing) return;
                    setIsDropdownOpen(!isDropdownOpen);
                    if (!hasDropdownOpened) setHasDropdownOpened(true);
                  }}
                >
                  <span>{effectiveStatus}</span>
                  <div
                    className={`usm-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                  >
                    <ChevronDownSmallIcon />
                  </div>
                </div>

                <div
                  className={`usm-dropdown-options ${isDropdownOpen ? "open" : hasDropdownOpened ? "closed" : ""}`}
                >
                  {options.map((status) => (
                    <div
                      key={status}
                      className={`usm-dropdown-option ${
                        effectiveStatus === status ? "selected" : ""
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
            )}

            {canOverride && (
              <label className={`usm-force-row ${isForcing ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  disabled={isProcessing}
                />
                <span>
                  <strong>Force (skip workflow)</strong>
                  <span className="usm-force-hint">
                    Bypasses the order workflow. Stock, payment and loyalty
                    points may need a manual check afterwards.
                  </span>
                </span>
              </label>
            )}

            <textarea
              className="usm-textarea"
              placeholder={
                isForcing
                  ? "Reason for forcing this status (required, saved in the audit log)..."
                  : "Enter reason for update (Required)..."
              }
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
            disabled={!reason.trim() || !effectiveStatus || isProcessing}
            onClick={handleConfirmClick}
          >
            {isProcessing
              ? "Processing..."
              : isForcing
                ? "Force update"
                : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
