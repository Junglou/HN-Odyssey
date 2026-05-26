// imports
import { useCheckout } from "../../hooks/checkout/useCheckout";
import CheckoutForm from "../../components/checkout/CheckoutForm";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import "./CheckoutPage.css";

// component
export default function CheckoutPage() {
  // hooks/states
  const {
    items,
    formData,
    promoCode,
    isSubscribed,
    isGift,
    otpTimer,
    loading,
    subtotal,
    shippingFee,
    taxes,
    total,
    setPromoCode,
    setIsSubscribed,
    setIsGift,
    handleChange,
    handleSendOtp,
    handlePlaceOrder,
  } = useCheckout();

  // render
  return (
    <div className="checkout-page-wrapper">
      <div className="checkout-grid">
        {/* Cột trái: Mảng trắng che kín toàn bộ lề trái từ trên xuống dưới */}
        <div className="checkout-left-col">
          <h1 className="checkout-page-title">Checkout</h1>
          <CheckoutForm
            formData={formData}
            isSubscribed={isSubscribed}
            isGift={isGift}
            otpTimer={otpTimer}
            loading={loading}
            onChange={handleChange}
            onSubscribeChange={setIsSubscribed}
            onGiftChange={setIsGift}
            onSendOtp={handleSendOtp}
          />
        </div>

        {/* Cột phải: Nền be tổng thể chứa khối Summary màu trắng */}
        <div className="checkout-right-col">
          <div className="checkout-summary-wrapper">
            <CheckoutSummary
              items={items}
              promoCode={promoCode}
              subtotal={subtotal}
              shippingFee={shippingFee}
              taxes={taxes}
              total={total}
              onPromoCodeChange={setPromoCode}
              onPlaceOrder={handlePlaceOrder}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
