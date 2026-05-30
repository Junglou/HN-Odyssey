// imports
import { useCheckout } from "../../hooks/checkout/useCheckout";
import CheckoutForm from "../../components/checkout/CheckoutForm";
import CheckoutPaymentForm from "../../components/checkout/CheckoutPaymentForm";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import CheckoutSuccessCard from "../../components/checkout/CheckoutSuccessCard";
import CheckoutRecommendations from "../../components/checkout/CheckoutRecommendations";
import "./CheckoutPage.css";

// component
export default function CheckoutPage() {
  // hooks/states
  const {
    step,
    items,
    recommendations,
    provinces,
    districts,
    wards,
    savedAddresses,
    isLogged,
    formData,
    paymentData,
    promoCode,
    isSubscribed,
    isGift,
    otpTimer,
    loading,
    subtotal,
    shippingFee,
    taxes,
    discountAmount,
    total,
    availablePromos,
    setPromoCode,
    setIsSubscribed,
    setIsGift,
    handleChange,
    handleSelectAddress,
    handlePaymentChange,
    handleSendOtp,
    handlePlaceOrder,
    handleReturnHome,
  } = useCheckout();

  // render
  return (
    <div className="checkout-page-wrapper">
      <div className="checkout-grid">
        <div className="checkout-left-col">
          {step !== 3 && (
            <h1 className="checkout-page-title">
              {step === 1 ? "Checkout" : "Payment"}
            </h1>
          )}

          {step === 1 && (
            <CheckoutForm
              provinces={provinces}
              districts={districts}
              wards={wards}
              savedAddresses={savedAddresses}
              isLogged={isLogged}
              formData={formData}
              isSubscribed={isSubscribed}
              isGift={isGift}
              otpTimer={otpTimer}
              loading={loading}
              onChange={handleChange}
              onSelectAddress={handleSelectAddress}
              onSubscribeChange={setIsSubscribed}
              onGiftChange={setIsGift}
              onSendOtp={handleSendOtp}
            />
          )}

          {step === 2 && (
            <CheckoutPaymentForm
              paymentData={paymentData}
              loading={loading}
              onChange={handlePaymentChange}
            />
          )}

          {step === 3 && (
            <CheckoutSuccessCard onReturnHome={handleReturnHome} />
          )}
        </div>

        {/* cột phải: tóm tắt đơn hàng hoặc danh sách gợi ý */}
        <div className="checkout-right-col">
          <div className="checkout-summary-wrapper">
            {step !== 3 ? (
              <CheckoutSummary
                items={items}
                promoCode={promoCode}
                subtotal={subtotal}
                shippingFee={shippingFee}
                taxes={taxes}
                discountAmount={discountAmount}
                total={total}
                availablePromos={availablePromos}
                onPromoCodeChange={setPromoCode}
                onPlaceOrder={handlePlaceOrder}
                loading={loading}
                submitButtonText={
                  step === 1 ? "Continue to Payment" : "Pay Now"
                }
              />
            ) : (
              <CheckoutRecommendations items={recommendations} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
