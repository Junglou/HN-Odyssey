// imports
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegister, type ApiError } from "../../hooks/auth/useRegister";
import type { RegisterPayload } from "../../types/auth";
import RegisterForm from "../../components/auth/RegisterForm";
import { toast } from "react-toastify";
import { useOAuthLogin } from "../../hooks/auth/useOAuthLogin";
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";
import "./RegisterPage.css";

// component
const RegisterPage = () => {
  // states
  const [isCollapsed, setIsCollapsed] = useState(false);

  // hooks
  const navigate = useNavigate();
  const { register, loading, error } = useRegister();
  useOAuthLogin();

  // handlers
  const handleRegister = async (formData: RegisterPayload) => {
    try {
      const response = await register(formData);
      toast.success("Đăng ký thành công! Vui lòng kiểm tra mã xác thực.");
      navigate("/verify-otp", {
        state: {
          email: formData.email,
          account: response?.account,
        },
      });
    } catch (err: unknown) {
      const apiError = err as ApiError;
      toast.error(apiError.message || "Đăng ký thất bại");
    }
  };

  // render
  return (
    <div
      className={`register-page-container ${isCollapsed ? "collapsed" : ""}`}
    >
      <div className="register-left-section">
        <RegisterForm
          onSubmit={handleRegister}
          loading={loading}
          error={error}
          onLoginClick={() => navigate("/login")}
          onSupportClick={() => navigate("/account-recovery")}
        />
      </div>

      <div
        className="register-back-arrow-container"
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

      <div className="register-right-section">
        <div className="register-info-card">
          <h2 className="register-info-title">No account? No problem.</h2>
          <p className="register-info-quote">
            “You don't need an account to get started—explore our products
            freely, choose what fits your needs, and make it yours with ease.”
          </p>
          <ul className="register-benefit-list">
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely with full access.
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <FileIcon />
              </span>
              View complete product details, guides, and policies.
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart and manage them easily.
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime for help or guidance.
            </li>
          </ul>
          <button
            className="register-explore-btn"
            onClick={() => navigate("/")}
          >
            Explore
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
