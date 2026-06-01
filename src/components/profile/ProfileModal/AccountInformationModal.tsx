import { useEffect, useRef, useState } from "react";
import "./AccountInformationModal.css";
import { ProfileModalPortal } from "./ProfileModalPortal";
import type { UserProfile } from "../../../types/user";

export type { UserProfile };

export type ContactOtpType = "EMAIL" | "PHONE";

export interface RequestContactOtpParams {
  type: ContactOtpType;
  newValue: string;
  currentPassword: string;
}

export interface VerifyContactOtpParams {
  code: string;
  type: ContactOtpType;
}

interface AccountModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onRequestContactOtp: (params: RequestContactOtpParams) => Promise<void>;
  onVerifyContactOtp: (params: VerifyContactOtpParams) => Promise<void>;
  isSubmitting?: boolean;
  requestingOtpType?: ContactOtpType | null;
  verifyingOtpType?: ContactOtpType | null;
}

const normalizePhone = (value: string) => value.trim();

export default function AccountModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onRequestContactOtp,
  onVerifyContactOtp,
  isSubmitting = false,
  requestingOtpType = null,
  verifyingOtpType = null,
}: AccountModalProps) {
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const confirmedPasswordRef = useRef("");
  const newEmailRef = useRef<HTMLInputElement | null>(null);
  const newPhoneRef = useRef<HTMLInputElement | null>(null);
  const emailOtpRef = useRef<HTMLInputElement | null>(null);
  const phoneOtpRef = useRef<HTMLInputElement | null>(null);

  const [passwordConfirmed, setPasswordConfirmed] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialData, setPrevInitialData] = useState(initialData);

  if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
    setPrevIsOpen(isOpen);
    setPrevInitialData(initialData);

    // reset các biến state ngay trong quá trình render để tránh cascading renders
    setPasswordConfirmed(false);
    setEmailOtpSent(false);
    setPhoneOtpSent(false);
  }

  const currentEmail = (initialData?.email ?? "").trim();
  const currentPhone = normalizePhone(initialData?.phone ?? "");

  useEffect(() => {
    // reset các ref và input dom bên trong effect để đảm bảo react render an toàn
    confirmedPasswordRef.current = "";

    if (isOpen) {
      if (passwordRef.current) passwordRef.current.value = "";
      if (newEmailRef.current) newEmailRef.current.value = "";
      if (newPhoneRef.current) newPhoneRef.current.value = "";
      if (emailOtpRef.current) emailOtpRef.current.value = "";
      if (phoneOtpRef.current) phoneOtpRef.current.value = "";
    }
  }, [isOpen, initialData]);

  const handleConfirmPassword = () => {
    const currentPassword = (passwordRef.current?.value ?? "").trim();
    if (!currentPassword) {
      alert("Enter your current password first.");
      return;
    }

    confirmedPasswordRef.current = currentPassword;
    setPasswordConfirmed(true);
    if (passwordRef.current) {
      passwordRef.current.value = currentPassword;
    }
  };

  const handleChangePassword = () => {
    confirmedPasswordRef.current = "";
    setPasswordConfirmed(false);
    setEmailOtpSent(false);
    setPhoneOtpSent(false);
    if (emailOtpRef.current) emailOtpRef.current.value = "";
    if (phoneOtpRef.current) phoneOtpRef.current.value = "";
  };

  const handleSendOtp = async (type: ContactOtpType) => {
    if (!passwordConfirmed || !confirmedPasswordRef.current) {
      alert("Confirm your current password first.");
      return;
    }

    const newValue =
      type === "EMAIL"
        ? (newEmailRef.current?.value ?? "").trim()
        : normalizePhone(newPhoneRef.current?.value ?? "");

    if (!newValue) {
      alert(
        type === "EMAIL" ? "Enter a new email." : "Enter a new phone number.",
      );
      return;
    }

    if (type === "EMAIL" && newValue === currentEmail) {
      alert("New email must be different from your current email.");
      return;
    }

    if (type === "PHONE" && newValue === currentPhone) {
      alert("New phone must be different from your current phone number.");
      return;
    }

    try {
      await onRequestContactOtp({
        type,
        newValue,
        currentPassword: confirmedPasswordRef.current,
      });
      if (type === "EMAIL") setEmailOtpSent(true);
      if (type === "PHONE") setPhoneOtpSent(true);
    } catch {
      // Hook shows toast.
    }
  };

  const handleVerifyOtp = async (type: ContactOtpType) => {
    const otpRef = type === "EMAIL" ? emailOtpRef : phoneOtpRef;
    const code = (otpRef.current?.value ?? "").trim();

    if (!code) {
      alert("Enter the OTP sent to your new contact.");
      return;
    }

    try {
      await onVerifyContactOtp({ type, code });
      if (type === "EMAIL") {
        setEmailOtpSent(false);
        if (newEmailRef.current) newEmailRef.current.value = "";
      }
      if (type === "PHONE") {
        setPhoneOtpSent(false);
        if (newPhoneRef.current) newPhoneRef.current.value = "";
      }
      if (otpRef.current) otpRef.current.value = "";
    } catch {
      // Hook shows toast.
    }
  };

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
              Password cannot be changed at this time.
            </p>
          </div>

          {!isViewOnly ? (
            <div className="um-form-group">
              <label>
                Current password <span className="req">*</span>
              </label>
              <div className="account-password-row">
                <input
                  ref={passwordRef}
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  disabled={isSubmitting || passwordConfirmed}
                />
                {!passwordConfirmed ? (
                  <button
                    type="button"
                    className="um-btn-modal-submit account-password-confirm-btn"
                    disabled={isSubmitting}
                    onClick={handleConfirmPassword}
                  >
                    Confirm password
                  </button>
                ) : (
                  <button
                    type="button"
                    className="um-btn-modal-cancel account-password-confirm-btn"
                    disabled={isSubmitting}
                    onClick={handleChangePassword}
                  >
                    Change
                  </button>
                )}
              </div>
              <p className="account-field-hint">
                {passwordConfirmed
                  ? "Password confirmed. You can update your email or phone below."
                  : "Confirm your password before requesting an OTP."}
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
                  disabled={isSubmitting || !passwordConfirmed}
                  aria-label="New email"
                />
                <button
                  type="button"
                  className="um-btn-modal-cancel account-otp-request-btn"
                  disabled={
                    isSubmitting ||
                    !passwordConfirmed ||
                    requestingOtpType === "EMAIL"
                  }
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
                      placeholder="OTP from new email"
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
                  placeholder="New phone number (10 digits, VN)"
                  disabled={isSubmitting || !passwordConfirmed}
                  aria-label="New phone"
                />
                <button
                  type="button"
                  className="um-btn-modal-cancel account-otp-request-btn"
                  disabled={
                    isSubmitting ||
                    !passwordConfirmed ||
                    requestingOtpType === "PHONE"
                  }
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
                      placeholder="OTP from new phone"
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
