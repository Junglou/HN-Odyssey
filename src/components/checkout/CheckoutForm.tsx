// imports
import { useState } from "react";
import {
  ArrowDownIcon,
  CheckBoxOutlineIcon,
  CheckBoxFilledIcon,
  PackageIcon,
} from "../../assets/icons/CheckoutIcons";
import {
  MOCK_STATES,
  MOCK_COUNTRIES,
  type CheckoutFormData,
} from "../../hooks/checkout/useCheckout";
import "./CheckoutForm.css";

// interfaces
interface CheckoutFormProps {
  formData: CheckoutFormData;
  isSubscribed: boolean;
  isGift: boolean;
  otpTimer: number;
  loading: boolean;
  onChange: (field: keyof CheckoutFormData, value: string) => void;
  onSubscribeChange: (val: boolean) => void;
  onGiftChange: (val: boolean) => void;
  onSendOtp: () => void;
}

// component
export default function CheckoutForm({
  formData,
  isSubscribed,
  isGift,
  otpTimer,
  loading,
  onChange,
  onSubscribeChange,
  onGiftChange,
  onSendOtp,
}: CheckoutFormProps) {
  // hooks/states
  const [openDropdown, setOpenDropdown] = useState<"state" | "country" | null>(
    null,
  );

  // handlers
  const handleToggleDropdown = (type: "state" | "country") => {
    if (loading) return;
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  const handleSelectOption = (field: "state" | "country", value: string) => {
    onChange(field, value);
    setOpenDropdown(null);
  };

  // render
  return (
    <div className="checkout-form-container">
      {/* row 1 */}
      <div className="checkout-form-row">
        <div className="checkout-input-group">
          <input
            type="text"
            className="checkout-form-input"
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="checkout-input-group">
          <input
            type="text"
            className="checkout-form-input"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* row 2 */}
      <div className="checkout-input-group">
        <input
          type="email"
          className="checkout-form-input"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => onChange("email", e.target.value)}
          disabled={loading}
        />
      </div>

      {/* row 3 */}
      <div className="checkout-input-group">
        <input
          type="text"
          className="checkout-form-input"
          placeholder="Address"
          value={formData.address}
          onChange={(e) => onChange("address", e.target.value)}
          disabled={loading}
        />
      </div>

      {/* row 4 */}
      <div className="checkout-input-group">
        <input
          type="text"
          className="checkout-form-input"
          placeholder="City"
          value={formData.city}
          onChange={(e) => onChange("city", e.target.value)}
          disabled={loading}
        />
      </div>

      {/* row 5: custom state dropdown */}
      <div className="checkout-form-row">
        <div
          className="checkout-input-group"
          onClick={() => handleToggleDropdown("state")}
        >
          <input
            type="text"
            className="checkout-form-input"
            placeholder="State"
            value={formData.state}
            readOnly
            disabled={loading}
            style={{ cursor: loading ? "not-allowed" : "pointer" }}
          />
          <ArrowDownIcon
            className={`checkout-select-icon ${openDropdown === "state" ? "open" : ""}`}
          />

          {openDropdown === "state" && (
            <div className="checkout-dropdown-list">
              {MOCK_STATES.map((state) => (
                <div
                  key={state}
                  className="checkout-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectOption("state", state);
                  }}
                >
                  {state}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="checkout-input-group">
          <input
            type="text"
            className="checkout-form-input"
            placeholder="Zip Code"
            value={formData.zipCode}
            onChange={(e) => onChange("zipCode", e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* row 6: custom country dropdown */}
      <div
        className="checkout-input-group"
        onClick={() => handleToggleDropdown("country")}
      >
        <input
          type="text"
          className="checkout-form-input"
          placeholder="Country"
          value={formData.country}
          readOnly
          disabled={loading}
          style={{ cursor: loading ? "not-allowed" : "pointer" }}
        />
        <ArrowDownIcon
          className={`checkout-select-icon ${openDropdown === "country" ? "open" : ""}`}
        />

        {openDropdown === "country" && (
          <div className="checkout-dropdown-list">
            {MOCK_COUNTRIES.map((country) => (
              <div
                key={country}
                className="checkout-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectOption("country", country);
                }}
              >
                {country}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* row 7: phone & otp */}
      <div className="checkout-form-row checkout-otp-row">
        <div className="checkout-input-group">
          <input
            type="text"
            className="checkout-form-input"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="checkout-otp-group">
          <div className="checkout-input-group">
            <input
              type="text"
              className="checkout-form-input"
              placeholder="OTP"
              value={formData.otp}
              onChange={(e) => onChange("otp", e.target.value)}
              disabled={loading}
            />
            {otpTimer > 0 && (
              <span className="checkout-otp-timer">{otpTimer}S</span>
            )}
          </div>

          <button
            type="button"
            className="checkout-send-otp-btn"
            onClick={onSendOtp}
            disabled={otpTimer > 0 || loading}
          >
            {otpTimer > 0 ? "Wait..." : "Send Request"}
          </button>
        </div>
      </div>

      {/* checkboxes */}
      <div className="checkout-checkbox-group">
        <div className="checkout-checkbox-wrapper">
          <label className="checkout-checkbox-label">
            <div
              className="checkout-checkbox-icon"
              onClick={() => onSubscribeChange(!isSubscribed)}
            >
              {isSubscribed ? <CheckBoxFilledIcon /> : <CheckBoxOutlineIcon />}
            </div>
            <span
              className="checkout-checkbox-text"
              onClick={() => onSubscribeChange(!isSubscribed)}
            >
              Receive updates, offers, and the latest news from us.
            </span>
          </label>
          {/* Text mượt mà nhờ CSS Animation */}
          {isSubscribed && (
            <p className="checkout-checkbox-subtext">
              By checking this box, you agree to receive recurring automated
              promotional and personalized marketing text messages (such as cart
              reminders) from Patagonia at the phone number provided. Consent is
              not required for purchase. Message frequency may vary. Message and
              data rates may apply. Reply HELP for help and STOP to cancel. View
              our Terms and Privacy Policy.
            </p>
          )}
        </div>

        <div className="checkout-checkbox-wrapper">
          <label className="checkout-checkbox-label">
            <div
              className="checkout-checkbox-icon"
              onClick={() => onGiftChange(!isGift)}
            >
              {isGift ? <CheckBoxFilledIcon /> : <CheckBoxOutlineIcon />}
            </div>
            <span
              className="checkout-checkbox-text"
              onClick={() => onGiftChange(!isGift)}
            >
              This order is a gift{" "}
              <PackageIcon className="checkout-gift-icon" />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
