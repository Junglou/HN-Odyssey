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

const LoginPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { login, loading, error } = useLogin();

  // GỌI HOOK OAUTH Ở ĐÂY
  // Nó sẽ tự động chạy ngầm khi trang Login được render.
  // Nếu trên URL có accessToken, nó sẽ tự động xử lý và chuyển hướng.
  useOAuthLogin();

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
        className="back-arrow-container"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <svg
          className="arrow-icon"
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
        <div className="info-card">
          <h2 className="info-title">No account? No problem.</h2>
          <p className="info-quote">
            “You don't need an account to get started...”
          </p>
          <ul className="benefit-list">
            {/* (Giữ nguyên list benefit) */}
            <li className="benefit-item">
              <span className="benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely with full access.
            </li>
            <li className="benefit-item">
              <span className="benefit-icon">
                <FileIcon />
              </span>
              View complete product details, guides, and policies.
            </li>
            <li className="benefit-item">
              <span className="benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart and manage them easily.
            </li>
            <li className="benefit-item">
              <span className="benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime for help or guidance.
            </li>
          </ul>
          <button className="explore-btn" onClick={() => navigate("/")}>
            Explore
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
