// imports
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";
import { useResetPassword } from "../../hooks/auth/useResetPassword";
import { toast } from "react-toastify";
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";
import "./ResetPasswordPage.css";

// component
const ResetPasswordPage = () => {
  // states
  const [isCollapsed, setIsCollapsed] = useState(false);

  // hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword, loading } = useResetPassword();

  // variables
  const identifier = location.state?.identifier;
  const otpCode = location.state?.otpCode;

  // lifecycle
  useEffect(() => {
    if (!identifier || !otpCode) {
      toast.error("Yêu cầu không hợp lệ. Vui lòng thực hiện lại.");
      navigate("/login");
    }
  }, [identifier, otpCode, navigate]);

  // handlers
  const handleReset = async (newPassword: string) => {
    try {
      await resetPassword({
        account: identifier,
        code: otpCode,
        newPassword: newPassword,
        confirmNewPassword: newPassword,
      });
      toast.success("Đổi mật khẩu thành công! Vui lòng đăng nhập.");
      navigate("/login");
    } catch (error) {
      console.error("Reset Password Error:", error);
      const errorMsg =
        (error as Error)?.message ||
        "Mã xác thực không hợp lệ hoặc đã hết hạn.";
      toast.error(errorMsg);
    }
  };

  // render
  return (
    <div className={`reset-page-container ${isCollapsed ? "collapsed" : ""}`}>
      <div className="reset-left-section">
        <ResetPasswordForm
          onSubmit={handleReset}
          loading={loading}
          onLoginClick={() => navigate("/login")}
          onRegisterClick={() => navigate("/register")}
          onHelpClick={() => {
            navigate("/verify-otp", {
              state: { email: identifier, type: "FORGOT_PASSWORD" },
            });
          }}
        />
      </div>

      <div
        className="reset-back-arrow-container"
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

      <div className="reset-right-section">
        <div className="reset-info-card">
          <h2 className="reset-info-title">No account? No problem.</h2>
          <p className="reset-info-quote">
            “You don't need an account to get started—explore our products
            freely, choose what fits your needs, and make it yours with ease.”
          </p>
          <ul className="reset-benefit-list">
            <li className="reset-benefit-item">
              <span className="reset-benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely with full access.
            </li>
            <li className="reset-benefit-item">
              <span className="reset-benefit-icon">
                <FileIcon />
              </span>
              View complete product details, guides, and policies.
            </li>
            <li className="reset-benefit-item">
              <span className="reset-benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart and manage them easily.
            </li>
            <li className="reset-benefit-item">
              <span className="reset-benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime for help or guidance.
            </li>
          </ul>
          <button className="reset-explore-btn">Explore</button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
