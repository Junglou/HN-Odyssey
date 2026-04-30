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

// options - Chốt theo thiết kế: Chỉ Voucher / Dịch vụ / Điểm thưởng
const PAYOUT_METHODS = [
  "Store Credit / Voucher",
  "Reward Points",
  "Service Promotion",
];

// component
export default function FinalizeValueModal({
  isOpen,
  tradeInId,
  onClose,
  onConfirm,
}: FinalizeValueModalProps) {
  // states
  const [finalValue, setFinalValue] = useState<number | "">("");
  const [method, setMethod] = useState(PAYOUT_METHODS[0]);
  const [note, setNote] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // logic: reset state safely
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFinalValue("");
      setMethod(PAYOUT_METHODS[0]);
      setNote("");
      setIsDropdownOpen(false);
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

  // Validation: Giá trị phải > 0 và bắt buộc có ghi chú thẩm định (BR5)
  const isFormValid =
    finalValue !== "" && Number(finalValue) > 0 && note.trim() !== "";

  return (
    <div className="fvm-overlay">
      <div className="fvm-modal">
        <div className="fvm-header">
          <h3 className="fvm-title">Finalize Trade-in & Inspection</h3>
        </div>

        <div className="fvm-body">
          {/* Final Assessed Value */}
          <div>
            <label className="fvm-label">
              Final Assessed Value ($) <span className="fvm-required">*</span>
            </label>
            <input
              type="number"
              className="fvm-input"
              placeholder="Enter final value after inspection..."
              value={finalValue}
              onChange={(e) => setFinalValue(Number(e.target.value) || "")}
              autoFocus
              min="0"
            />
          </div>

          {/* Payout Method */}
          <div>
            <label className="fvm-label">Payout Method</label>
            <div className="fvm-custom-dropdown" ref={dropdownRef}>
              <div
                className={`fvm-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{method}</span>
                <div
                  className={`fvm-dropdown-arrow ${isDropdownOpen ? "open" : ""}`}
                >
                  <ChevronDownSmallIcon />
                </div>
              </div>

              {isDropdownOpen && (
                <div className="fvm-dropdown-options">
                  {PAYOUT_METHODS.map((m) => (
                    <div
                      key={m}
                      className={`fvm-dropdown-option ${method === m ? "selected" : ""}`}
                      onClick={() => {
                        setMethod(m);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
