// imports
import { useState } from "react";
import {
  ArrowDownIcon,
  CheckBoxOutlineIcon,
  CheckBoxFilledIcon,
  PackageIcon,
} from "../../assets/icons/CheckoutIcons";
import {
  MOCK_COUNTRIES,
  type CheckoutFormData,
  type LocationItem,
  type SavedAddress,
} from "../../hooks/checkout/useCheckout";
import "./CheckoutForm.css";

// interfaces
interface CheckoutFormProps {
  provinces: LocationItem[];
  districts: LocationItem[];
  wards: LocationItem[];
  savedAddresses: SavedAddress[];
  isLogged: boolean;
  formData: CheckoutFormData;
  isSubscribed: boolean;
  isGift: boolean;
  otpTimer: number;
  loading: boolean;
  onChange: (field: keyof CheckoutFormData, value: string) => void;
  onSelectAddress: (id: string) => void;
  onSubscribeChange: (val: boolean) => void;
  onGiftChange: (val: boolean) => void;
  onSendOtp: () => void;
}

// component
export default function CheckoutForm({
  provinces,
  districts,
  wards,
  savedAddresses,
  isLogged,
  formData,
  isSubscribed,
  isGift,
  otpTimer,
  loading,
  onChange,
  onSelectAddress,
  onSubscribeChange,
  onGiftChange,
  onSendOtp,
}: CheckoutFormProps) {
  // hooks/states
  const [openDropdown, setOpenDropdown] = useState<
    "addressBook" | "province" | "district" | "ward" | "country" | null
  >(null);

  // handlers
  const handleToggleDropdown = (type: typeof openDropdown) => {
    if (loading) return;
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  // Helper tìm tên hiển thị dựa trên Code
  const displayProvince =
    provinces.find((p) => p.code === formData.provinceCode)?.name || "";
  const displayDistrict =
    districts.find((d) => d.code === formData.districtCode)?.name || "";
  const displayWard =
    wards.find((w) => w.code === formData.wardCode)?.name || "";
  const displayAddressBook =
    formData.selectedAddressId === "new"
      ? "Add New Address"
      : savedAddresses.find((a) => a._id === formData.selectedAddressId)?.name +
          " - " +
          savedAddresses.find((a) => a._id === formData.selectedAddressId)
            ?.street || "";

  // FLAG QUYẾT ĐỊNH ẨN/HIỆN FORM ĐỊA CHỈ CHI TIẾT
  const showAddressFields =
    !isLogged ||
    savedAddresses.length === 0 ||
    formData.selectedAddressId === "new";

  // render
  return (
    <div className="checkout-form-container">
      {/* Tính năng chọn Address Book (Nếu đã đăng nhập & có địa chỉ) */}
      {isLogged && savedAddresses.length > 0 && (
        <div
          className={`checkout-input-group ${openDropdown === "addressBook" ? "dropdown-active" : ""}`}
          style={{ marginBottom: "0.5rem" }}
          onClick={() => handleToggleDropdown("addressBook")}
        >
          <input
            type="text"
            className="checkout-form-input"
            placeholder="Select saved address..."
            value={displayAddressBook}
            readOnly
            disabled={loading}
            style={{
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          />
          <ArrowDownIcon
            className={`checkout-select-icon ${openDropdown === "addressBook" ? "open" : ""}`}
          />
          {openDropdown === "addressBook" && (
            <div className="checkout-dropdown-list">
              {savedAddresses.map((addr) => (
                <div
                  key={addr._id}
                  className="checkout-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAddress(addr._id);
                    setOpenDropdown(null);
                  }}
                >
                  {addr.name} - {addr.phone} - {addr.street}
                </div>
              ))}
              <div
                className="checkout-dropdown-item"
                style={{ fontWeight: 700, borderTop: "1px solid #eee" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAddress("new");
                  setOpenDropdown(null);
                }}
              >
                + Add New Address
              </div>
            </div>
          )}
        </div>
      )}

      {/* row 1: Names */}
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

      {/* row 2: Email & Phone */}
      <div className="checkout-form-row">
        <div className="checkout-input-group">
          <input
            type="email"
            className="checkout-form-input"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => onChange("email", e.target.value)}
            disabled={loading || (isLogged && !!formData.email)}
          />
        </div>
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
      </div>

      {/* CHỈ HIỂN THỊ CÁC ROW ĐỊA CHỈ CHI TIẾT KHI ĐÁP ỨNG ĐIỀU KIỆN */}
      {showAddressFields && (
        <div className="checkout-new-address-wrapper">
          {/* row 3: Street Address */}
          <div className="checkout-input-group">
            <input
              type="text"
              className="checkout-form-input"
              placeholder="Street Address"
              value={formData.street}
              onChange={(e) => onChange("street", e.target.value)}
              disabled={loading}
            />
          </div>

          {/* row 4: Tỉnh/Thành phố & Quận/Huyện */}
          <div className="checkout-form-row">
            <div
              className={`checkout-input-group ${openDropdown === "province" ? "dropdown-active" : ""}`}
              onClick={() => handleToggleDropdown("province")}
            >
              <input
                type="text"
                className="checkout-form-input"
                placeholder="Province / City"
                value={displayProvince}
                readOnly
                disabled={loading}
                style={{ cursor: loading ? "not-allowed" : "pointer" }}
              />
              <ArrowDownIcon
                className={`checkout-select-icon ${openDropdown === "province" ? "open" : ""}`}
              />
              {openDropdown === "province" && provinces.length > 0 && (
                <div className="checkout-dropdown-list">
                  {provinces.map((prov) => (
                    <div
                      key={prov.code}
                      className="checkout-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange("provinceCode", prov.code);
                        setOpenDropdown(null);
                      }}
                    >
                      {prov.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`checkout-input-group ${openDropdown === "district" ? "dropdown-active" : ""}`}
              onClick={() => handleToggleDropdown("district")}
            >
              <input
                type="text"
                className="checkout-form-input"
                placeholder="District"
                value={displayDistrict}
                readOnly
                disabled={loading || !formData.provinceCode}
                style={{
                  cursor:
                    loading || !formData.provinceCode
                      ? "not-allowed"
                      : "pointer",
                }}
              />
              <ArrowDownIcon
                className={`checkout-select-icon ${openDropdown === "district" ? "open" : ""}`}
              />
              {openDropdown === "district" && districts.length > 0 && (
                <div className="checkout-dropdown-list">
                  {districts.map((dist) => (
                    <div
                      key={dist.code}
                      className="checkout-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange("districtCode", dist.code);
                        setOpenDropdown(null);
                      }}
                    >
                      {dist.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* row 5: Phường/Xã & Country */}
          <div className="checkout-form-row">
            <div
              className={`checkout-input-group ${openDropdown === "ward" ? "dropdown-active" : ""}`}
              onClick={() => handleToggleDropdown("ward")}
            >
              <input
                type="text"
                className="checkout-form-input"
                placeholder="Ward / Commune"
                value={displayWard}
                readOnly
                disabled={loading || !formData.districtCode}
                style={{
                  cursor:
                    loading || !formData.districtCode
                      ? "not-allowed"
                      : "pointer",
                }}
              />
              <ArrowDownIcon
                className={`checkout-select-icon ${openDropdown === "ward" ? "open" : ""}`}
              />
              {openDropdown === "ward" && wards.length > 0 && (
                <div className="checkout-dropdown-list">
                  {wards.map((ward) => (
                    <div
                      key={ward.code}
                      className="checkout-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange("wardCode", ward.code);
                        setOpenDropdown(null);
                      }}
                    >
                      {ward.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`checkout-input-group ${openDropdown === "country" ? "dropdown-active" : ""}`}
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
                        onChange("country", country);
                        setOpenDropdown(null);
                      }}
                    >
                      {country}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* row 6: OTP (Chỉ hiển thị cho Khách Vãng Lai) */}
      {!isLogged && (
        <div className="checkout-form-row checkout-otp-row">
          <div className="checkout-otp-group">
            <div className="checkout-input-group">
              <input
                type="text"
                className="checkout-form-input"
                placeholder="OTP Verification Code"
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
      )}

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
