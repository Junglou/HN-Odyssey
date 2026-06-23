// imports
import {
  RadioOutlineIcon,
  RadioFilledIcon,
} from "../../assets/icons/CheckoutIcons";
import type { CheckoutPaymentData } from "../../hooks/checkout/useCheckout";
import "./CheckoutPaymentForm.css";
import MoMoLogo from "../../assets/images/momo-logo.png";

// interfaces
interface CheckoutPaymentFormProps {
  paymentData: CheckoutPaymentData;
  loading: boolean;
  onChange: (field: keyof CheckoutPaymentData, value: string) => void;
}

// component
export default function CheckoutPaymentForm({
  paymentData,
  loading,
  onChange,
}: CheckoutPaymentFormProps) {
  // render
  return (
    <div className="checkout-payment-container">
      {/* 1. Thanh toán khi nhận hàng (COD) */}
      <div
        className={`checkout-payment-card ${paymentData.method === "COD" ? "active" : ""}`}
      >
        <div
          className="checkout-payment-header"
          onClick={() => !loading && onChange("method", "COD")}
        >
          <div className="checkout-payment-radio">
            {paymentData.method === "COD" ? (
              <RadioFilledIcon />
            ) : (
              <RadioOutlineIcon />
            )}
          </div>
          <span className="checkout-payment-title">Cash on Delivery (COD)</span>
        </div>

        {paymentData.method === "COD" && (
          <div className="checkout-payment-body">
            <p
              style={{
                fontFamily: '"Lexend", sans-serif',
                color: "#555",
                margin: 0,
                lineHeight: 1.5,
                fontSize: "0.9rem",
              }}
            >
              Thanh toán bằng tiền mặt khi đơn vị vận chuyển giao hàng đến địa
              chỉ của bạn.
            </p>
          </div>
        )}
      </div>

      {/* 2. Cổng thanh toán VNPAY */}
      <div
        className={`checkout-payment-card ${paymentData.method === "VNPAY" ? "active" : ""}`}
      >
        <div
          className="checkout-payment-header"
          onClick={() => !loading && onChange("method", "VNPAY")}
        >
          <div className="checkout-payment-radio">
            {paymentData.method === "VNPAY" ? (
              <RadioFilledIcon />
            ) : (
              <RadioOutlineIcon />
            )}
          </div>
          <span className="checkout-payment-title">VNPAY Gateway</span>
        </div>

        {paymentData.method === "VNPAY" && (
          <div className="checkout-payment-body">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <img
                src="https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png"
                alt="VNPAY"
                style={{ height: "30px", objectFit: "contain" }}
              />
              <p
                style={{
                  fontFamily: '"Lexend", sans-serif',
                  color: "#555",
                  margin: 0,
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                Thanh toán an toàn qua VNPAY. Hỗ trợ quét mã QR bằng ứng dụng
                ngân hàng, thẻ ATM nội địa và thẻ tín dụng (Visa/Mastercard).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Cổng thanh toán MoMo */}
      <div
        className={`checkout-payment-card ${paymentData.method === "MOMO" ? "active" : ""}`}
      >
        <div
          className="checkout-payment-header"
          onClick={() => !loading && onChange("method", "MOMO")}
        >
          <div className="checkout-payment-radio">
            {paymentData.method === "MOMO" ? (
              <RadioFilledIcon />
            ) : (
              <RadioOutlineIcon />
            )}
          </div>
          <span className="checkout-payment-title">MoMo E-Wallet</span>
        </div>

        {paymentData.method === "MOMO" && (
          <div className="checkout-payment-body">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <img
                src={MoMoLogo} // Đổi src thành biến đã import
                alt="MoMo"
                style={{ height: "35px", objectFit: "contain" }}
              />
              <p
                style={{
                  fontFamily: '"Lexend", sans-serif',
                  color: "#555",
                  margin: 0,
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                Hệ thống sẽ chuyển hướng sang ứng dụng hoặc website MoMo để bạn
                tiến hành quét mã QR thanh toán nhanh chóng.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
