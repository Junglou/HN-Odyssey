import { useState, type FormEvent } from "react";
import "./VerifyOtpForm.css";
import { toast } from "react-toastify";

interface VerifyOtpFormProps {
  initialEmail?: string;
  onSubmit: (email: string, otp: string) => void;
  onResend: (email: string) => void;
  timer: number;
  loading: boolean;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onHelpClick: () => void;
}

// Form chính
const VerifyOtpForm = ({
  initialEmail = "",
  onSubmit,
  onResend,
  timer,
  loading,
  onLoginClick,
  onRegisterClick,
  onHelpClick,
}: VerifyOtpFormProps) => {
  // State
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");

  // Handlers xử lý sự kiện
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate cơ bản
    if (!email || !otp) {
      toast.warning("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    onSubmit(email, otp);
  };

  const handleResend = () => {
    if (!email) {
      toast.warning("Vui lòng nhập Email/SĐT để nhận mã!");
      return;
    }
    onResend(email);
  };

  // Render giao diện
  return (
    <div className="verify-form-wrapper">
      <h1 className="verify-title">We need to confirm it’s really you.</h1>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          <div className="verify-input-group">
            <input
              type="text"
              className="verify-form-input"
              placeholder="Email/Phone number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <span className="verify-required-mark">*</span>
          </div>

          <div className="verify-otp-row">
            <div className="verify-otp-input-container">
              <input
                type="text"
                className="verify-form-input"
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                style={{ letterSpacing: "2px" }}
              />
              {timer > 0 && <span className="verify-otp-timer">{timer}S</span>}
            </div>

            <button
              type="button"
              className="verify-send-btn"
              onClick={handleResend}
              disabled={timer > 0 || loading}
            >
              {timer > 0 ? "Wait..." : "Send Request"}
            </button>
          </div>

          <div className="verify-help-text" onClick={onHelpClick}>
            Need help accessing your account?
          </div>

          {/* Nút Xác thực */}
          <button
            type="submit"
            className="verify-process-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing" : "Process"}
          </button>
        </fieldset>
      </form>

      {/* Link điều hướng dưới cùng */}
      <div className="verify-footer-links">
        <span className="verify-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>
        <span className="verify-text-link" onClick={onLoginClick}>
          Already have one.
        </span>
      </div>
    </div>
  );
};

export default VerifyOtpForm;
