import { useState } from "react";
import "./SetPriceModal.css";

// Khai báo interface chuẩn thay cho any
export interface PriceSubmitData {
  priceAmount: number;
  currency: string;
  effectiveDate: string;
}

export interface SetPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  initialPrice?: number;
  initialCurrency?: string;
  isSubmitting?: boolean;
  onSave: (data: PriceSubmitData) => void;
}

export default function SetPriceModal(props: SetPriceModalProps) {
  if (!props.isOpen) return null;
  const modalKey = props.sku || "new-price";
  return <SetPriceModalContent key={modalKey} {...props} />;
}

function SetPriceModalContent({
  onClose,
  productName,
  sku,
  initialPrice = 0,
  initialCurrency = "USD",
  isSubmitting = false,
  onSave,
}: Omit<SetPriceModalProps, "isOpen">) {
  const [priceAmount, setPriceAmount] = useState<string>(
    initialPrice > 0 ? initialPrice.toString() : "",
  );

  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [error, setError] = useState<string>("");

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [effectiveDate] = useState<string>(getTodayString());

  const handleSave = () => {
    if (isSubmitting) return;

    const numPrice = parseFloat(priceAmount);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Price amount must be greater than 0.");
      return;
    }

    setError("");

    // Truyền trực tiếp object chuẩn xác
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
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="spm-input-group">
            <label>
              Effective Date <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input type="date" value={effectiveDate} disabled readOnly />
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
