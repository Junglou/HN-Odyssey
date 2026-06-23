// imports
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VerifyOtpForm from "../../components/auth/VerifyOtpForm";
import { useVerifyOtp } from "../../hooks/auth/useVerifyOtp";
import { toast } from "react-toastify";
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";
import "./VerifyOtpPage.css";

// component
const VerifyOtpPage = () => {
  // states
  const [isCollapsed, setIsCollapsed] = useState(false);

  // hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { verify, resend, loading: verifyLoading, timer } = useVerifyOtp();

  // variables
  const isLoading = verifyLoading;
  const emailFromState = location.state?.email || "";
  const type = location.state?.type || "REGISTER";

  // handlers
  const handleVerify = async (inputValue: string, otp: string) => {
    const payload = {
      account: inputValue,
      code: otp,
      type: type === "FORGOT_PASSWORD" ? "RESET_PASSWORD" : "REGISTER",
    };

    try {
      await verify(payload);
      if (type === "FORGOT_PASSWORD") {
        toast.success("Xác thực thành công! Vui lòng đặt lại mật khẩu.");
        navigate("/reset-password", {
          state: { identifier: inputValue, otpCode: otp },
        });
      } else {
        toast.success("Kích hoạt tài khoản thành công! Hãy đăng nhập.");
        navigate("/login");
      }
    } catch (error) {
      console.error("Verify Error:", error);
    }
  };

  const handleResendRequest = async (inputValue: string) => {
    const payload = {
      account: inputValue,
      type: type === "FORGOT_PASSWORD" ? "RESET_PASSWORD" : "REGISTER",
    };

    try {
      await resend(payload);
      toast.success(
        type === "FORGOT_PASSWORD"
          ? "Mã OTP khôi phục đã được gửi lại!"
          : "Mã kích hoạt đã được gửi lại!",
      );
    } catch (error) {
      console.error("Resend Error:", error);
    }
  };

  const handleHelpClick = () => {
    navigate("/account-recovery", { state: { email: emailFromState } });
  };

  // render
  return (
    <div className={`verify-page-container ${isCollapsed ? "collapsed" : ""}`}>
      <div className="verify-left-section">
        <VerifyOtpForm
          initialEmail={emailFromState}
          onSubmit={handleVerify}
          onResend={handleResendRequest}
          onHelpClick={handleHelpClick}
          timer={timer}
          loading={isLoading}
          onLoginClick={() => navigate("/login")}
          onRegisterClick={() => navigate("/register")}
        />
      </div>

      <div
        className="verify-back-arrow-container"
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

      <div className="verify-right-section">
        <div className="verify-info-card">
          <h2 className="verify-info-title">
            {type === "FORGOT_PASSWORD"
              ? "Reset Password"
              : "No account? No problem."}
          </h2>
          <p className="verify-info-quote">
            “You don't need an account to get started—explore our products
            freely, choose what fits your needs, and make it yours with ease.”
          </p>
          <ul className="verify-benefit-list">
            <li className="verify-benefit-item">
              <span className="verify-benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely with full access.
            </li>
            <li className="verify-benefit-item">
              <span className="verify-benefit-icon">
                <FileIcon />
              </span>
              View complete product details, guides, and policies.
            </li>
            <li className="verify-benefit-item">
              <span className="verify-benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart and manage them easily.
            </li>
            <li className="verify-benefit-item">
              <span className="verify-benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime for help or guidance.
            </li>
          </ul>
          <button className="verify-explore-btn">Explore</button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
