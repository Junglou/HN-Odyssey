// imports
import { useState } from "react";
import { PlusSquareIcon } from "../../assets/icons/CheckoutIcons";
import { type CheckoutItem } from "../../hooks/checkout/useCheckout";
import "./CheckoutSummary.css";

// interfaces
interface CheckoutSummaryProps {
  items: CheckoutItem[];
  promoCode: string;
  subtotal: number;
  shippingFee: string | number;
  taxes: number;
  discountAmount?: number;
  total: number;
  onPromoCodeChange: (val: string) => void;
  onPlaceOrder: () => void;
  loading: boolean;
  submitButtonText?: string;
  availablePromos?: string[]; // Thêm prop này để thay thế mock data
}

// component
export default function CheckoutSummary({
  items,
  promoCode,
  subtotal,
  shippingFee,
  taxes,
  discountAmount,
  total,
  onPromoCodeChange,
  onPlaceOrder,
  loading,
  submitButtonText,
  availablePromos = [], // Mặc định mảng rỗng để không hiển thị dropdown giả
}: CheckoutSummaryProps) {
  // hooks/states
  const [isPromoOpen, setIsPromoOpen] = useState(false);

  // helpers: lọc mã giảm giá theo từ khóa người dùng gõ từ prop truyền vào
  const filteredCodes = availablePromos.filter((code) =>
    code.toLowerCase().includes(promoCode.toLowerCase()),
  );

  // handlers: xử lý khi click vào nút cộng để đóng/mở dropdown
  const handleTogglePromoDropdown = (e: React.MouseEvent) => {
    e.preventDefault(); // Ngăn input bị blur đột ngột làm mất dropdown
    if (loading) return;
    setIsPromoOpen((prev) => !prev);
  };

  // render
  return (
    <div className="checkout-summary-container">
      {/* list items */}
      <div className="checkout-summary-items-list">
        {items.map((item) => (
          <div key={item.id} className="checkout-summary-item-card">
            <div className="checkout-summary-item-img-box">
              <img src={item.image} alt={item.name} />
            </div>

            <div className="checkout-summary-item-info">
              <h4 className="checkout-summary-item-name">{item.name}</h4>
              <p className="checkout-summary-item-desc">{item.description}</p>

              <div className="checkout-summary-item-meta">
                <span className="checkout-summary-item-price">
                  Price: {item.price}$
                </span>
                <span className="checkout-summary-item-qty">
                  Qty: {item.quantity}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* promo code combobox */}
      <div className="checkout-summary-promo-wrapper">
        <div className="checkout-summary-promo-input-group">
          <input
            type="text"
            className="checkout-summary-promo-input"
            placeholder="Gift Card/Promo Code"
            value={promoCode}
            onChange={(e) => {
              onPromoCodeChange(e.target.value);
              setIsPromoOpen(true);
            }}
            onFocus={() => setIsPromoOpen(true)}
            onBlur={() => setTimeout(() => setIsPromoOpen(false), 200)}
            disabled={loading}
          />
          <button
            type="button"
            className="checkout-summary-promo-btn"
            onMouseDown={handleTogglePromoDropdown}
            disabled={loading}
          >
            <PlusSquareIcon />
          </button>

          {/* hiển thị dropdown danh sách mã code khi có dữ liệu truyền vào */}
          {isPromoOpen && filteredCodes.length > 0 && (
            <div className="checkout-promo-dropdown-list">
              {filteredCodes.map((code) => (
                <div
                  key={code}
                  className="checkout-promo-dropdown-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPromoCodeChange(code);
                    setIsPromoOpen(false);
                  }}
                >
                  {code}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* pricing block */}
      <div className="checkout-summary-pricing-block">
        <div className="checkout-summary-pricing-row">
          <span>Subtotal:</span>
          {/* Thêm toLocaleString() và đổi $ thành đ */}
          <span>{subtotal.toLocaleString()}đ</span>
        </div>

        <div className="checkout-summary-pricing-row">
          <span>Shipping fee:</span>
          {/* shippingFee vốn dĩ đã là string có sẵn chữ đ từ hook nên giữ nguyên */}
          <span>{shippingFee}</span>
        </div>

        {discountAmount !== undefined && discountAmount > 0 && (
          <div
            className="checkout-summary-pricing-row"
            style={{ color: "#d32f2f", fontWeight: 500 }}
          >
            <span>Discount (Voucher):</span>
            <span>-{discountAmount.toLocaleString()}đ</span>
          </div>
        )}

        <div className="checkout-summary-pricing-row">
          <span>Taxes:</span>
          <span>{taxes.toLocaleString()}đ</span>
        </div>

        <div className="checkout-summary-pricing-row checkout-summary-total-row">
          <span>Total:</span>
          <span>{total.toLocaleString()}đ</span>
        </div>
      </div>

      {/* submit button */}
      <button
        type="button"
        className="checkout-summary-submit-btn"
        onClick={onPlaceOrder}
        disabled={loading}
      >
        {loading ? "Processing..." : submitButtonText || "Place Order"}
      </button>
    </div>
  );
}
