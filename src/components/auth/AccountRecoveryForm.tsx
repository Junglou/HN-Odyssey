import { useState, type ChangeEvent, type FormEvent } from "react";
import "./AccountRecoveryForm.css";
import { toast } from "react-toastify";
import type { AccountRecoveryPayload } from "../../types/auth";

// interfaces
interface AccountRecoveryFormProps {
  initialEmail?: string;
  timer: number;
  loading: boolean;
  onSendOtp: (email: string) => void;
  onSubmit: (data: AccountRecoveryPayload) => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const AccountRecoveryForm = ({
  initialEmail = "",
  timer,
  loading,
  onSendOtp,
  onSubmit,
  onLoginClick,
  onRegisterClick,
}: AccountRecoveryFormProps) => {
  // hooks/states
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // handlers
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.warning("File quá lớn! Vui lòng chọn file dưới 10MB.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSendOtp = () => {
    if (!email) {
      toast.warning("Vui lòng nhập Email/SĐT trước.");
      return;
    }
    onSendOtp(email);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate các trường bắt buộc
    if (!email || !otp || !description) {
      toast.warning(
        "Vui lòng điền đầy đủ thông tin bắt buộc (Email, OTP, Mô tả).",
      );
      return;
    }

    onSubmit({
      email,
      otpCode: otp,
      description,
      images: file,
    });
  };

  // render
  return (
    <div className="recovery-form-wrapper">
      <h1 className="recovery-title">We need to confirm it’s really you.</h1>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          {/* Trường input */}
          <div className="recovery-input-group">
            <input
              type="text"
              className="recovery-form-input"
              placeholder="Email/Phone number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <span className="recovery-required-mark">*</span>
          </div>

          {/* Otp + nút gửi */}
          <div className="recovery-otp-row">
            <div className="recovery-otp-input-container">
              <input
                type="text"
                className="recovery-form-input"
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                style={{ letterSpacing: "2px" }}
              />
              {/* Hiển thị Timer đếm ngược */}
              {timer > 0 && (
                <span className="recovery-otp-timer">{timer}S</span>
              )}
            </div>

            {/* Nút Send Request */}
            <button
              type="button"
              className="recovery-send-btn"
              onClick={handleSendOtp}
              disabled={timer > 0 || loading}
            >
              {timer > 0 ? "Wait..." : "Send Request"}
            </button>
          </div>

          {/* Textarea */}
          <div className="recovery-input-group">
            <textarea
              className="recovery-form-input"
              placeholder="Tell us your problem..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4} // Độ cao mặc định
            />
          </div>

          {/* File input */}
          <div className="recovery-file-input-wrapper">
            {/* Input gốc bị ẩn đi */}
            <input
              type="file"
              id="evidence-file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {/* Label tùy chỉnh đè lên để làm giao diện */}
            <label
              htmlFor="evidence-file"
              className={`recovery-file-input-label ${file ? "has-file" : ""}`}
            >
              {/* Hiển thị tên file hoặc placeholder */}
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "90%",
                }}
              >
                {file ? file.name : "Please provide supporting evidence."}
              </span>

              {/* Icon kẹp giấy SVG */}
              <svg
                className="recovery-paperclip-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </label>
          </div>

          {/* Nút Process */}
          <button
            type="submit"
            className="recovery-process-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing..." : "Process"}
          </button>
        </fieldset>
      </form>

      {/* Links */}
      <div className="recovery-footer-links">
        <span className="recovery-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>
        <span className="recovery-text-link" onClick={onLoginClick}>
          Already have one.
        </span>
      </div>
    </div>
  );
};

export default AccountRecoveryForm;
