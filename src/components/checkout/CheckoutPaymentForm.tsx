// imports
import {
  RadioOutlineIcon,
  RadioFilledIcon,
} from "../../assets/icons/CheckoutIcons";
import type { CheckoutPaymentData } from "../../hooks/checkout/useCheckout";
import "./CheckoutPaymentForm.css";

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
      {/* credit card block */}
      <div
        className={`checkout-payment-card ${paymentData.method === "credit_card" ? "active" : ""}`}
      >
        <div
          className="checkout-payment-header"
          onClick={() => !loading && onChange("method", "credit_card")}
        >
          <div className="checkout-payment-radio">
            {paymentData.method === "credit_card" ? (
              <RadioFilledIcon />
            ) : (
              <RadioOutlineIcon />
            )}
          </div>
          <span className="checkout-payment-title">Credit Card</span>
        </div>

        {paymentData.method === "credit_card" && (
          <div className="checkout-payment-body">
            <div className="checkout-payment-input-group">
              <input
                type="text"
                className="checkout-payment-input"
                placeholder="Name of card holder"
                value={paymentData.cardName}
                onChange={(e) => onChange("cardName", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="checkout-payment-input-group">
              <input
                type="text"
                className="checkout-payment-input"
                placeholder="Card number"
                value={paymentData.cardNumber}
                onChange={(e) => onChange("cardNumber", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="checkout-payment-row">
              <div className="checkout-payment-input-group">
                <input
                  type="text"
                  className="checkout-payment-input"
                  placeholder="MM/YY"
                  value={paymentData.expDate}
                  onChange={(e) => onChange("expDate", e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="checkout-payment-input-group">
                <input
                  type="password"
                  className="checkout-payment-input"
                  placeholder="CVV"
                  value={paymentData.cvv}
                  onChange={(e) => onChange("cvv", e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* qr pay & e-wallet block */}
      <div
        className={`checkout-payment-card ${paymentData.method === "qr_pay" ? "active" : ""}`}
      >
        <div
          className="checkout-payment-header"
          onClick={() => !loading && onChange("method", "qr_pay")}
        >
          <div className="checkout-payment-radio">
            {paymentData.method === "qr_pay" ? (
              <RadioFilledIcon />
            ) : (
              <RadioOutlineIcon />
            )}
          </div>
          <span className="checkout-payment-title">QR Pay & E-Wallet</span>
        </div>

        {paymentData.method === "qr_pay" && (
          <div className="checkout-payment-body checkout-wallet-body">
            <div className="checkout-wallet-options">
              {["momo", "zalo_pay", "qr_pay", "atm"].map((wallet) => (
                <button
                  key={wallet}
                  type="button"
                  className={`checkout-wallet-btn ${paymentData.eWallet === wallet ? "selected" : ""}`}
                  onClick={() => onChange("eWallet", wallet)}
                  disabled={loading}
                >
                  {wallet.replace("_", " ").toUpperCase()}
                </button>
              ))}
            </div>

            <div className="checkout-qr-display">
              <img
                src="https://placehold.co/355x355/png?text=QR+CODE"
                alt="Payment QR"
              />
              <p className="checkout-qr-instruction">
                Scan with your{" "}
                {paymentData.eWallet.replace("_", " ").toUpperCase()} app
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
