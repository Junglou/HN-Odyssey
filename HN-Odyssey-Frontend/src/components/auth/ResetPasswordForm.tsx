import { useState, type FormEvent } from "react";
import "./ResetPasswordForm.css";
import { toast } from "react-toastify";

interface ResetPasswordFormProps {
  onSubmit: (password: string) => void;
  loading: boolean;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onHelpClick: () => void;
}

const ResetPasswordForm = ({
  onSubmit,
  loading,
  onLoginClick,
  onRegisterClick,
  onHelpClick,
}: ResetPasswordFormProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.warning("Vui lòng nhập đầy đủ mật khẩu mới!");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Pass qua validate -> Gửi lên page xử lý
    onSubmit(newPassword);
  };

  return (
    <div className="reset-form-wrapper">
      <h1 className="reset-title">Let’s get you back in.</h1>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}
        >
          {/* New Password */}
          <div className="reset-input-group">
            <input
              type="password"
              className="reset-form-input"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <span className="reset-required-mark">*</span>
          </div>

          {/* Confirm Password */}
          <div className="reset-input-group">
            <input
              type="password"
              className="reset-form-input"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <span className="reset-required-mark">*</span>
          </div>

          <div className="reset-help-text" onClick={onHelpClick}>
            Need help accessing your account?
          </div>

          <button
            type="submit"
            className="reset-process-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing..." : "Process"}
          </button>
        </fieldset>
      </form>

      <div className="reset-secondary-links">
        <span className="reset-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>
        <span className="reset-text-link" onClick={onLoginClick}>
          Already have one.
        </span>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
