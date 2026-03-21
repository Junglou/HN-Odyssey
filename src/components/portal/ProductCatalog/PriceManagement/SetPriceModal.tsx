import { useState, useEffect } from "react";
import "./SetPriceModal.css";

// định nghĩa type khớp với hook usePriceManagement
export interface PriceFormData {
  priceAmount: number;
  currency: string;
  effectiveDate: string;
}

// Props
export interface SetPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  initialPrice?: number;
  isSubmitting: boolean;
  onSave: (data: PriceFormData) => void;
}

// component bọc ngoài để xử lý key khởi tạo lại modal một cách an toàn
export default function SetPriceModal(props: SetPriceModalProps) {
  if (!props.isOpen) return null;

  // sử dụng key để ép react tạo lại component mỗi khi mở hoặc đổi sản phẩm (tránh dùng useEffect gây lỗi)
  const modalKey = props.sku || "new-price";
  return <SetPriceModalContent key={modalKey} {...props} />;
}

// component nội dung chính của modal
function SetPriceModalContent({
  onClose,
  productName,
  sku,
  initialPrice = 0,
  isSubmitting,
  onSave,
}: Omit<SetPriceModalProps, "isOpen">) {
  // khởi tạo giá trị trực tiếp ngay từ đầu, không cần useEffect
  const [priceAmount, setPriceAmount] = useState<string>(
    initialPrice > 0 ? initialPrice.toString() : "",
  );
  const [error, setError] = useState<string>("");

  // khởi tạo ngày hiện tại một lần duy nhất theo định dạng YYYY-MM-DD
  const [currentDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // lắng nghe phím tắt để đóng (đây là side effect hợp lệ để đăng ký event listener)
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
    setError("");

    // trả về object chứa đầy đủ thông tin
    onSave({
      priceAmount: numPrice,
      currency: "USD",
      effectiveDate: currentDate,
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
              disabled={isSubmitting}
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
