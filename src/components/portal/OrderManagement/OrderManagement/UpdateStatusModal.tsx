import { useState, useRef, useEffect } from "react";
import "./UpdateStatusModal.css";
import type { OrderStatus } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import { ChevronDownSmallIcon } from "../../../../assets/icons/OrderManagementIcons";

// props
interface UpdateStatusModalProps {
  isOpen: boolean;
  orderId: string | null;
  currentStatus: OrderStatus | null;
  onClose: () => void;
  onConfirm: (orderId: string, newStatus: OrderStatus, reason: string) => void;
}

// options
const STATUS_LIST: OrderStatus[] = [
  "Confirmed",
  "Packaging",
  "Shipping",
  "Delivered",
  "Cancelled",
  "Refunded",
];

// component
export default function UpdateStatusModal({
  isOpen,
  orderId,
  currentStatus,
  onClose,
  onConfirm,
}: UpdateStatusModalProps) {
  // states
  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus>("Confirmed");
  const [reason, setReason] = useState("");
  const [prevStatus, setPrevStatus] = useState<OrderStatus | null>(null);

  // dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // logic: sync currentStatus
  if (currentStatus !== prevStatus) {
    setPrevStatus(currentStatus);
    setSelectedStatus(
      currentStatus === "Pending" ? "Confirmed" : currentStatus || "Confirmed",
    );
    setReason("");
  }

  // close dropdown on outside click
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

            {/* Custom Dropdown */}
            <div className="usm-custom-dropdown" ref={dropdownRef}>
              <div
                className={`usm-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{selectedStatus}</span>
                <div
                  className={`usm-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              {isDropdownOpen && (
                <div className="usm-dropdown-options">
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
              )}
            </div>

            <textarea
              className="usm-textarea"
              placeholder="Enter reason for update (Required)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="usm-footer">
          <button className="usm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="usm-btn-confirm"
            disabled={!reason.trim()}
            onClick={() => onConfirm(orderId, selectedStatus, reason)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
