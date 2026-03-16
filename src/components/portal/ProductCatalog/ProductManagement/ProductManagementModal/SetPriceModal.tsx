import { useState } from "react";
import "./SetPriceModal.css";

// Props
export interface SetPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  initialPrice?: number;
  onSave: (newPrice: number) => void;
}

export default function SetPriceModal({
  isOpen,
  onClose,
  productName,
  sku,
  initialPrice = 0,
  onSave,
}: SetPriceModalProps) {
  // Quản lý giá nhập
  const [priceAmount, setPriceAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // state tracking mở/đóng modal
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    // reset lại các giá trị modal
    if (isOpen) {
      setPriceAmount(initialPrice > 0 ? initialPrice.toString() : "");
      setError("");

      // lấy format dạng YYYY-MM-DD
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setCurrentDate(`${yyyy}-${mm}-${dd}`);
    }
  }

  if (!isOpen) return null;

  // nút Save Price
  const handleSave = () => {
    const numPrice = parseFloat(priceAmount);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Price amount must be greater than 0.");
      return;
    }
    setError("");
    onSave(numPrice);
  };

  return (
    <div className="spm-modal-overlay" onClick={onClose}>
      <div className="spm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="spm-modal-header">
          <h3 className="spm-modal-title">Set Price</h3>
          <button type="button" className="spm-close-btn" onClick={onClose}>
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
            <label>Price Amount (USD)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={error ? "spm-input-error" : ""}
              value={priceAmount}
              onChange={(e) => {
                setPriceAmount(e.target.value);
                if (error) setError(""); // xóa lỗi khi gõ lại
              }}
              placeholder="0.00"
            />
          </div>
          <div className="spm-input-group">
            <label>Currency</label>
            <select disabled>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="spm-input-group">
            <label>Effective Date</label>
            <input type="date" value={currentDate} readOnly disabled />
          </div>
        </div>
        {error && <div className="spm-error-text">{error}</div>}
        <div className="spm-warning-banner">
          <span>⚠️</span>
          This price requires approval before being published.
        </div>
        <div className="spm-modal-footer">
          <button type="button" className="spm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="spm-btn-save" onClick={handleSave}>
            Save Price
          </button>
        </div>
      </div>
    </div>
  );
}
