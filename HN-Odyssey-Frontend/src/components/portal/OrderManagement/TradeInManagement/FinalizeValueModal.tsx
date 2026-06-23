import { useState, useRef, useEffect } from "react";
import "./FinalizeValueModal.css";
import { ChevronDownSmallIcon } from "../../../../assets/icons/TradeInManagementIcons";

// props
interface FinalizeValueModalProps {
  isOpen: boolean;
  tradeInId: string | null;
  onClose: () => void;
  onConfirm: (
    id: string,
    finalValue: number,
    method: string,
    note: string,
  ) => void;
}

// options cập nhật theo Enum hệ thống
const PAYOUT_METHODS = ["Percentage Voucher", "Reward Points", "Fixed Amount"];

// component
export default function FinalizeValueModal({
  isOpen,
  tradeInId,
  onClose,
  onConfirm,
}: FinalizeValueModalProps) {
  // states
  const [method, setMethod] = useState("");
  const [finalValue, setFinalValue] = useState<number | "">("");
  const [note, setNote] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasDropdownOpened, setHasDropdownOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // logic: reset state safely
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMethod("");
      setFinalValue("");
      setNote("");
      setIsDropdownOpen(false);
      setHasDropdownOpened(false);
    }
  }

  // logic: close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  if (!isOpen || !tradeInId) return null;

  // Validation: bắt buộc chọn Method, Value > 0, nếu Percentage Value <= 100
  const isFormValid =
    method !== "" &&
    finalValue !== "" &&
    Number(finalValue) > 0 &&
    (method !== "Percentage Voucher" || Number(finalValue) <= 100) &&
    note.trim() !== "";

  // logic: Đổi nhãn động theo phương thức thanh toán
  const getValueLabel = () => {
    if (method === "Percentage Voucher") return "Discount Percentage (%)";
    if (method === "Reward Points") return "Reward Points Amount";
    if (method === "Fixed Amount") return "Fixed Voucher Amount ($)";
    return "Final Assessed Value";
  };

  const getValuePlaceholder = () => {
    if (method === "Percentage Voucher") return "Ex: 10, 20 (Max 100)...";
    if (method === "Reward Points") return "Ex: 500, 1000...";
    if (method === "Fixed Amount") return "Ex: 50, 100...";
    return "Enter final value...";
  };

  return (
    <div className="fvm-overlay">
      <div className="fvm-modal">
        <div className="fvm-header">
          <h3 className="fvm-title">Finalize Trade-in & Inspection</h3>
        </div>

        <div className="fvm-body">
          {/* Payout Method (Hiển thị đầu tiên) */}
          <div>
            <label className="fvm-label">
              Payout Method <span className="fvm-required">*</span>
            </label>
            <div className="fvm-custom-dropdown" ref={dropdownRef}>
              <div
                className={`fvm-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  if (!hasDropdownOpened) setHasDropdownOpened(true);
                }}
              >
                <span style={{ color: method ? "#111827" : "#6b7280" }}>
                  {method || "Select Payout Method..."}
                </span>
                <div
                  className={`fvm-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              <div
                className={`fvm-dropdown-options ${isDropdownOpen ? "open" : hasDropdownOpened ? "closed" : ""}`}
              >
                {PAYOUT_METHODS.map((m) => (
                  <div
                    key={m}
                    className={`fvm-dropdown-option ${method === m ? "selected" : ""}`}
                    onClick={() => {
                      setMethod(m);
                      setFinalValue(""); // Khởi tạo lại Input tránh lưu đè sai logic max value
                      setIsDropdownOpen(false);
                    }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Final Assessed Value - Bị ẩn cho đến khi chọn Payout Method */}
          {method && (
            <div style={{ animation: "fadeIn 0.2s ease-out" }}>
              <label className="fvm-label">
                {getValueLabel()} <span className="fvm-required">*</span>
              </label>
              <input
                type="number"
                className="fvm-input"
                placeholder={getValuePlaceholder()}
                value={finalValue}
                onChange={(e) => {
                  let val = Number(e.target.value);
                  // Giới hạn trực tiếp tại ô input nếu chọn quy đổi %
                  if (method === "Percentage Voucher" && val > 100) {
                    val = 100;
                  }
                  setFinalValue(val || "");
                }}
                autoFocus
                min="0"
                max={method === "Percentage Voucher" ? "100" : undefined}
              />
            </div>
          )}

          {/* Inspection Note */}
          <div>
            <label className="fvm-label">
              Inspection Note <span className="fvm-required">*</span>
            </label>
            <textarea
              className="fvm-textarea"
              placeholder="Detail the actual condition vs customer's description..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="fvm-footer">
          <button className="fvm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="fvm-btn-confirm"
            disabled={!isFormValid}
            onClick={() =>
              onConfirm(tradeInId, Number(finalValue), method, note)
            }
          >
            Complete Trade-in
          </button>
        </div>
      </div>
    </div>
  );
}
