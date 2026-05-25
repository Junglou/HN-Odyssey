// imports
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../../hooks/auth/useLogin";
import type { ApiError } from "../../hooks/auth/useLogin";
import type { LoginPayload } from "../../types/auth";
import LoginForm from "../../components/auth/LoginForm";
import { toast } from "react-toastify";
import "./LoginPage.css";
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";
import { useOAuthLogin } from "../../hooks/auth/useOAuthLogin";

// component
const LoginPage = () => {
  // states
  const [isCollapsed, setIsCollapsed] = useState(false);

  // hooks
  const navigate = useNavigate();
  const { login, loading, error } = useLogin();
  useOAuthLogin();

  // handlers
  const handleLogin = async (data: LoginPayload) => {
    try {
      await login(data);
      toast.success("Đăng nhập thành công!");
      // navigate("/dashboard");
    } catch (err: unknown) {
      const apiError = err as ApiError;
      toast.error(apiError.message || "Đăng nhập thất bại");
    }
  };

  // render
  return (
    <div className={`login-page-container ${isCollapsed ? "collapsed" : ""}`}>
      <div className="login-left-section">
        <LoginForm
          onSubmit={handleLogin}
          loading={loading}
          error={error}
          onRegisterClick={() => navigate("/register")}
          onForgotPasswordClick={() =>
            navigate("/verify-otp", { state: { type: "FORGOT_PASSWORD" } })
          }
          onSupportClick={() => navigate("/account-recovery")}
        />
      </div>

      <div
        className="login-back-arrow-container"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <svg
          className="login-arrow-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </div>

      <div className="login-right-section">
        <div className="login-info-card">
          <h2 className="login-info-title">No account? No problem.</h2>
          <p className="login-info-quote">
            “You don't need an account to get started...”
          </p>
          <ul className="login-benefit-list">
            <li className="login-benefit-item">
              <span className="login-benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely with full access.
            </li>
            <li className="login-benefit-item">
              <span className="login-benefit-icon">
                <FileIcon />
              </span>
              View complete product details, guides, and policies.
            </li>
            <li className="login-benefit-item">
              <span className="login-benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart and manage them easily.
            </li>
            <li className="login-benefit-item">
              <span className="login-benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime for help or guidance.
            </li>
          </ul>
          <button className="login-explore-btn" onClick={() => navigate("/")}>
            Explore
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
