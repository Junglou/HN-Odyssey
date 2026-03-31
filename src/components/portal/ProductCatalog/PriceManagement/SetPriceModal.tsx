import { useState, useEffect } from "react";
import "./SetPriceModal.css";
import type { PriceFormData } from "../../../../hooks/portal/ProductCatalog/PriceManagement/usePriceManagement";

//prop
export interface SetPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  initialPrice?: number;
  isSubmitting: boolean;
  onSave: (data: PriceFormData) => void;
}

export default function SetPriceModal(props: SetPriceModalProps) {
  if (!props.isOpen) return null;

  const modalKey = props.sku || "new-price";
  return <SetPriceModalContent key={modalKey} {...props} />;
}

// component modal
function SetPriceModalContent({
  onClose,
  productName,
  sku,
  initialPrice = 0,
  isSubmitting,
  onSave,
}: Omit<SetPriceModalProps, "isOpen">) {
  const [priceAmount, setPriceAmount] = useState<string>(
    initialPrice > 0 ? initialPrice.toString() : "",
  );

  const [currency, setCurrency] = useState<string>("USD");
  const [error, setError] = useState<string>("");

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [effectiveDate, setEffectiveDate] = useState<string>(getTodayString());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  // nút save price
  const handleSave = () => {
    if (isSubmitting) return;

    const numPrice = parseFloat(priceAmount);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Price amount must be greater than 0.");
      return;
    }

    if (!effectiveDate) {
      setError("Effective date is required.");
      return;
    }

    setError("");

    // Trả về dữ liệu thực tế thay vì hardcode USD và ngày hiện tại
    onSave({
      priceAmount: numPrice,
      currency,
      effectiveDate,
    });
  };

  return (
    <div
      className="spm-modal-overlay"
      onClick={!isSubmitting ? onClose : undefined}
    >
      <div className="spm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="spm-modal-header">
          <h3 className="spm-modal-title">Set Price</h3>
          <button
            type="button"
            className="spm-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="spm-product-info">
          <div>
            <strong>Product:</strong> {productName}
          </div>
          <div>
            <strong>SKU:</strong> {sku}
          </div>
        </div>

        <div className="spm-input-grid">
          <div className="spm-input-group">
            <label>
              Price Amount <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={error.includes("Price") ? "spm-input-error" : ""}
              value={priceAmount}
              onChange={(e) => {
                setPriceAmount(e.target.value);
                if (error) setError("");
              }}
              placeholder="0.00"
              disabled={isSubmitting}
            />
          </div>
          <div className="spm-input-group">
            <label>Currency</label>
            {/* Đã gỡ readonly/disabled, cho phép chọn ngoại tệ */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="USD">USD</option>
              <option value="VND">VND</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="spm-input-group">
            <label>
              Effective Date <span style={{ color: "#ef4444" }}>*</span>
            </label>
            {/* Đã gỡ readonly/disabled, cho phép chọn ngày áp dụng (không được chọn ngày trong quá khứ) */}
            <input
              type="date"
              min={getTodayString()}
              value={effectiveDate}
              onChange={(e) => {
                setEffectiveDate(e.target.value);
                if (error) setError("");
              }}
              disabled={isSubmitting}
              className={error.includes("date") ? "spm-input-error" : ""}
            />
          </div>
        </div>

        {error && <div className="spm-error-text">{error}</div>}

        <div className="spm-warning-banner">
          <span>⚠️</span>
          This price requires approval before being published.
        </div>

        <div className="spm-modal-footer">
          <button
            type="button"
            className="spm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="spm-btn-save"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Price"}
          </button>
        </div>
      </div>
    </div>
  );
}
