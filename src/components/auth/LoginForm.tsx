import { useState, type FormEvent } from "react";
import type { LoginPayload } from "../../types/auth";
import "./LoginForm.css";
import { GoogleIcon, FacebookIcon, ZaloIcon } from "../../assets/icons";

// interfaces
interface LoginFormProps {
  onSubmit: (data: LoginPayload) => void;
  loading: boolean;
  error: string | null;
  onRegisterClick: () => void;
  onForgotPasswordClick: () => void;
  onSupportClick: () => void;
}

const LoginForm = ({
  onSubmit,
  loading,
  error,
  onRegisterClick,
  onForgotPasswordClick,
  onSupportClick,
}: LoginFormProps) => {
  // hooks/states
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const backendUrl =
    import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  // handlers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ account, password });
  };

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

  // render
  return (
    <div className="login-form-wrapper">
      <h1 className="login-title">Welcome back!</h1>
      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}
        >
          {/* ... (Các Input giữ nguyên) ... */}
          <div className="login-input-group">
            <input
              type="text"
              className={`login-form-input ${error ? "input-error" : ""}`}
              placeholder="Email or Phone Number"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
            />
            <span className="login-required-mark">*</span>
          </div>

          <div className="login-input-group">
            <input
              type="password"
              className="login-form-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="login-required-mark">*</span>
          </div>

          <p
            className="login-forget-password-text"
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

      <div className="login-secondary-links">
        <span className="login-text-link" onClick={onRegisterClick}>
          You are new? Join just here.
        </span>

        <span className="login-text-link" onClick={onSupportClick}>
          Need help accessing your account?
        </span>
      </div>

      <div className="login-social-login">
        <button
          type="button"
          className="login-social-icon-btn"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
        </button>
        <button
          type="button"
          className="login-social-icon-btn"
          disabled={loading}
          onClick={handleFacebookLogin}
        >
          <FacebookIcon />
        </button>
        <button className="login-social-icon-btn" disabled={loading}>
          <ZaloIcon />
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
