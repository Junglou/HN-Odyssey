// src/components/auth/AccountRecoVerifiedForm.tsx
import { useState, type FormEvent } from "react";
import "./AccountRecoVerifiedForm.css";
import { toast } from "react-toastify";

export interface RecoVerifiedPayload {
  newPassword: string;
  confirmNewPassword: string;
  newEmail: string;
  confirmNewEmail: string;
  otpCode: string;
}

interface AccountRecoVerifiedFormProps {
  loading: boolean;
  timer: number;
  onSendOtp: (email: string) => void;
  onSubmit: (data: RecoVerifiedPayload) => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const AccountRecoVerifiedForm = ({
  loading,
  timer,
  onSendOtp,
  onSubmit,
  onLoginClick,
  onRegisterClick,
}: AccountRecoVerifiedFormProps) => {
  const [formData, setFormData] = useState<RecoVerifiedPayload>({
    newPassword: "",
    confirmNewPassword: "",
    newEmail: "",
    confirmNewEmail: "",
    otpCode: "",
  });

  const handleChange = (field: keyof RecoVerifiedPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendOtp = () => {
    if (!formData.newEmail) {
      toast.warning("Vui lòng nhập Email mới trước để nhận mã.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.newEmail)) {
      toast.warning("Email không hợp lệ.");
      return;
    }
    onSendOtp(formData.newEmail);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const {
      newPassword,
      confirmNewPassword,
      newEmail,
      confirmNewEmail,
      otpCode,
    } = formData;

    if (!newPassword || !newEmail || !otpCode) {
      toast.warning("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Mật khẩu mới không khớp!");
      return;
    }

    if (newEmail !== confirmNewEmail) {
      toast.error("Email xác nhận không khớp!");
      return;
    }

    // Pass qua validate -> Gửi lên page xử lý
    onSubmit(formData);
  };

  return (
    <div className="verified-form-wrapper">
      <h1 className="verified-form-title">Let’s get you back in.</h1>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          {/* New Password */}
          <div className="verified-input-group">
            <input
              type="password"
              className="verified-form-input"
              placeholder="New Password"
              value={formData.newPassword}
              onChange={(e) => handleChange("newPassword", e.target.value)}
              required
            />
            <span className="verified-required-mark">*</span>
          </div>

          {/* Confirm New Password */}
          <div className="verified-input-group">
            <input
              type="password"
              className="verified-form-input"
              placeholder="Confirm New Password"
              value={formData.confirmNewPassword}
              onChange={(e) =>
                handleChange("confirmNewPassword", e.target.value)
              }
              required
            />
            <span className="verified-required-mark">*</span>
          </div>

          {/* New Email */}
          <div className="verified-input-group">
            <input
              type="email"
              className="verified-form-input"
              placeholder="New email"
              value={formData.newEmail}
              onChange={(e) => handleChange("newEmail", e.target.value)}
              required
            />
            <span className="verified-required-mark">*</span>
          </div>

          {/* Confirm New Email */}
          <div className="verified-input-group">
            <input
              type="email"
              className="verified-form-input"
              placeholder="Confirm New Email"
              value={formData.confirmNewEmail}
              onChange={(e) => handleChange("confirmNewEmail", e.target.value)}
              required
            />
            <span className="verified-required-mark">*</span>
          </div>

          {/* OTP Row */}
          <div className="verified-otp-row">
            <div className="verified-otp-container">
              <input
                type="text"
                className="verified-form-input"
                placeholder="OTP"
                value={formData.otpCode}
                onChange={(e) => handleChange("otpCode", e.target.value)}
                maxLength={6}
                required
                style={{ letterSpacing: "2px" }}
              />
              {timer > 0 && (
                <span className="verified-otp-timer">{timer}S</span>
              )}
            </div>

            <button
              type="button"
              className="verified-send-btn"
              onClick={handleSendOtp}
              disabled={timer > 0 || loading}
            >
              {timer > 0 ? "Wait..." : "Send Request"}
            </button>
          </div>

          {/* Process Button */}
          <button
            type="submit"
            className="verified-process-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing..." : "Process"}
          </button>
        </fieldset>
      </form>

      {/* Footer Links */}
      <div className="verified-footer-links">
        <span className="verified-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>
        <span className="verified-text-link" onClick={onLoginClick}>
          Already have one.
        </span>
      </div>
    </div>
  );
};

export default AccountRecoVerifiedForm;
