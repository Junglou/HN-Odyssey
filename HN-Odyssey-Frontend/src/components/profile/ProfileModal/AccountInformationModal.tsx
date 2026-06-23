import "./AccountInformationModal.css";
import { ProfileModalPortal } from "./ProfileModalPortal";
import type { UserProfile } from "../../../types/user";
import {
  useAccountInformationModal,
  type ContactOtpType,
} from "../../../hooks/profile/useAccountInformationModal";

export type { UserProfile, ContactOtpType };

interface AccountModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  refreshProfile?: () => Promise<UserProfile>;
}

export default function AccountModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onProfileUpdated,
  refreshProfile,
}: AccountModalProps) {
  const {
    currentEmail,
    currentPhone,
    passwordRef,
    newEmailRef,
    newPhoneRef,
    emailOtpRef,
    phoneOtpRef,
    emailOtpSent,
    phoneOtpSent,
    isSubmitting,
    requestingOtpType,
    verifyingOtpType,
    handleSendOtp,
    handleVerifyOtp,
  } = useAccountInformationModal({
    isOpen,
    initialData,
    onProfileUpdated,
    refreshProfile,
  });

  if (!isOpen) return null;

  const isViewOnly = mode === "view";

  return (
    <ProfileModalPortal isOpen={isOpen} onClose={onClose}>
      <div
        className="um-modal-box account-info-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="um-modal-title">
          {mode === "edit" ? "Edit account" : "Account details"}
        </h2>

        <div className="um-modal-form">
          <div className="um-form-group account-field-readonly">
            <label>Username</label>
            <input
              type="text"
              value={initialData?.username ?? ""}
              disabled
              readOnly
              aria-label="Username (read only)"
            />
            <p className="account-field-hint">
              Username cannot be changed at this time.
            </p>
          </div>

          <div className="um-form-group account-field-readonly">
            <label>Password</label>
            <input
              type="password"
              value="************"
              disabled
              readOnly
              aria-label="Password masked (read only)"
            />
            <p className="account-field-hint">
              Use forgot password on the login page to reset your password.
            </p>
          </div>

          {!isViewOnly ? (
            <div className="um-form-group">
              <label>
                Current password <span className="req">*</span>
              </label>
              <input
                ref={passwordRef}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                disabled={isSubmitting}
              />
              <p className="account-field-hint">
                Required when sending an OTP. Your password is checked by the
                server at that step.
              </p>
            </div>
          ) : null}

          <div className="um-form-group account-editable-group">
            <label>Email</label>
            <input
              type="email"
              value={currentEmail || "—"}
              disabled
              readOnly
              aria-label="Current email"
            />

            {!isViewOnly ? (
              <div className="account-otp-section">
                <p className="account-field-hint">
                  Enter a new email, then send an OTP to that address. The code
                  is sent to the new email, not your current one.
                </p>
                <input
                  ref={newEmailRef}
                  name="newEmail"
                  type="email"
                  placeholder="New email address"
                  disabled={isSubmitting}
                  aria-label="New email"
                />
                <button
                  type="button"
                  className="um-btn-modal-cancel account-otp-request-btn"
                  disabled={isSubmitting || requestingOtpType === "EMAIL"}
                  onClick={() => void handleSendOtp("EMAIL")}
                >
                  {requestingOtpType === "EMAIL"
                    ? "Sending..."
                    : "Send OTP to new email"}
                </button>

                {emailOtpSent ? (
                  <>
                    <input
                      ref={emailOtpRef}
                      type="text"
                      className="account-otp-input"
                      placeholder="6-digit OTP from new email"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={8}
                      disabled={isSubmitting}
                      aria-label="New email OTP"
                    />
                    <button
                      type="button"
                      className="um-btn-modal-submit account-otp-request-btn"
                      disabled={isSubmitting || verifyingOtpType === "EMAIL"}
                      onClick={() => void handleVerifyOtp("EMAIL")}
                    >
                      {verifyingOtpType === "EMAIL"
                        ? "Saving..."
                        : "Confirm new email"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="um-form-group account-editable-group">
            <label>Phone</label>
            <input
              type="text"
              value={currentPhone || "—"}
              disabled
              readOnly
              aria-label="Current phone"
            />

            {!isViewOnly ? (
              <div className="account-otp-section">
                <p className="account-field-hint">
                  Enter a new phone number, then send an OTP to that number. The
                  code is sent to the new phone, not your current one.
                </p>
                <input
                  ref={newPhoneRef}
                  name="newPhone"
                  type="text"
                  placeholder="New phone (10 digits, e.g. 09xxxxxxxx)"
                  disabled={isSubmitting}
                  aria-label="New phone"
                />
                <button
                  type="button"
                  className="um-btn-modal-cancel account-otp-request-btn"
                  disabled={isSubmitting || requestingOtpType === "PHONE"}
                  onClick={() => void handleSendOtp("PHONE")}
                >
                  {requestingOtpType === "PHONE"
                    ? "Sending..."
                    : "Send OTP to new phone"}
                </button>

                {phoneOtpSent ? (
                  <>
                    <input
                      ref={phoneOtpRef}
                      type="text"
                      className="account-otp-input"
                      placeholder="6-digit OTP from new phone"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={8}
                      disabled={isSubmitting}
                      aria-label="New phone OTP"
                    />
                    <button
                      type="button"
                      className="um-btn-modal-submit account-otp-request-btn"
                      disabled={isSubmitting || verifyingOtpType === "PHONE"}
                      onClick={() => void handleVerifyOtp("PHONE")}
                    >
                      {verifyingOtpType === "PHONE"
                        ? "Saving..."
                        : "Confirm new phone"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="um-modal-actions">
            <button
              type="button"
              className="um-btn-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {isViewOnly ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </ProfileModalPortal>
  );
}
