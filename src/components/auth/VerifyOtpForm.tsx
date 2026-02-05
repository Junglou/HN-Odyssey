import { useState, type FormEvent } from "react";
import "./VerifyOtpForm.css";
import { toast } from "react-toastify";

interface VerifyOtpFormProps {
  initialEmail?: string;
  onSubmit: (email: string, otp: string) => void; // Hàm xử lý khi bấm nút Process
  onResend: (email: string) => void; // Hàm xử lý khi bấm nút Send Request
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
  // Khởi tạo giá trị ban đầu là initialEmail (từ location state)
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");

  // Handlers xử lý sự kiện
  // Xử lý khi Submit Form (Nút Process)
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); // Chặn reload trang

    // Validate cơ bản
    if (!email || !otp) {
      toast.warning("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    // Gọi hàm onSubmit của cha (VerifyOtpPage)
    onSubmit(email, otp);
  };

  // Xử lý khi bấm Gửi lại mã (Send Request)
  const handleResend = () => {
    if (!email) {
      toast.warning("Vui lòng nhập Email/SĐT để nhận mã!");
      return;
    }
    // Gọi hàm onResend của cha
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
          {/* Input Email/SDT */}
          <div className="verify-input-group">
            <input
              type="text"
              className="verify-form-input"
              placeholder="Email/Phone number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {/* Dấu sao bắt buộc */}
            <span className="verify-required-mark">*</span>
          </div>

          {/* Hàng chứa: OTP + Timer + Nút gửi */}
          <div className="verify-otp-row">
            {/* Ô nhập OTP (Chứa cả Timer bên trong) */}
            <div className="otp-input-container">
              <input
                type="text"
                className="verify-form-input" // Dùng chung style gạch chân
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                style={{ letterSpacing: "2px" }} // Giãn chữ số cho dễ nhìn
              />
              {/* Hiển thị đếm ngược (nếu timer > 0) */}
              {timer > 0 && <span className="otp-timer">{timer}S</span>}
            </div>

            {/* Nút Send Request (Nằm cạnh ô OTP) */}
            <button
              type="button"
              className="verify-send-btn"
              onClick={handleResend}
              disabled={timer > 0 || loading} // Disable khi đang đếm ngược hoặc loading
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
        <span className="text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>
        <span className="text-link" onClick={onLoginClick}>
          Already have one.
        </span>
      </div>
    </div>
  );
};

export default VerifyOtpForm;
