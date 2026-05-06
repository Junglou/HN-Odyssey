import { useState, type FormEvent } from "react";
import type { LoginPayload } from "../../types/auth";
import "./LoginForm.css";
import { GoogleIcon, FacebookIcon, ZaloIcon } from "../../assets/icons";

interface LoginFormProps {
  onSubmit: (data: LoginPayload) => void;
  loading: boolean;
  error: string | null;
  onRegisterClick: () => void;
  onForgotPasswordClick: () => void;
  onSupportClick: () => void; // <--- THÊM PROP NÀY
}

const LoginForm = ({
  onSubmit,
  loading,
  error,
  onRegisterClick,
  onForgotPasswordClick,
  onSupportClick, // <--- NHẬN PROP
}: LoginFormProps) => {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ account, password });
  };

  // THÊM LOGIC XỬ LÝ ĐĂNG NHẬP MẠNG XÃ HỘI
  const backendUrl =
    import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  const handleGoogleLogin = () => {
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleFacebookLogin = () => {
    window.location.href = `${backendUrl}/auth/facebook`;
  };

  // Nút Zalo bạn chưa có API BE, tạm thời có thể hiển thị thông báo
  // const handleZaloLogin = () => {
  //   alert("Chức năng đăng nhập Zalo đang được phát triển.");
  // };

  return (
    <div className="login-form-wrapper">
      <h1 className="login-title">Welcome back!</h1>
      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}
        >
          {/* ... (Các Input giữ nguyên) ... */}
          <div className="input-group">
            <input
              type="text"
              className={`form-input ${error ? "input-error" : ""}`}
              placeholder="Email or Phone Number"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
            />
            <span className="required-mark">*</span>
          </div>

          <div className="input-group">
            <input
              type="password"
              className="form-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="required-mark">*</span>
          </div>

          {/* Sửa class tại đây */}
          <p
            className="forget-password-text" // Class này bạn đã fix ở bước trước, nếu chưa thì đổi nốt thành .login-text-link cũng được
            onClick={onForgotPasswordClick}
          >
            Forget your password. Need a hand?
          </p>

          <button
            type="submit"
            className="login-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </fieldset>
      </form>

      <div className="secondary-links">
        {/* CẬP NHẬT CLASS NAME: login-text-link */}
        <span className="login-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>

        {/* GẮN LINK SUPPORT */}
        <span className="login-text-link" onClick={onSupportClick}>
          Need help accessing your account?
        </span>
      </div>

      <div className="social-login">
        <button
          type="button" // Nhớ thêm type="button" để tránh nó submit form
          className="social-icon-btn"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
        </button>
        <button
          type="button"
          className="social-icon-btn"
          disabled={loading}
          onClick={handleFacebookLogin}
        >
          <FacebookIcon />
        </button>
        <button className="social-icon-btn" disabled={loading}>
          <ZaloIcon />
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
