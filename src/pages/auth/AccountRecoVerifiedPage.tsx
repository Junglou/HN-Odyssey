import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountRecoVerifiedForm, {
  type RecoVerifiedPayload,
} from "../../components/auth/AccountRecoVerifiedForm";
import { useAccountRecoVerified } from "../../hooks/auth/useAccountRecoVerified";
import { useVerifyOtp } from "../../hooks/auth/useVerifyOtp";
import { toast } from "react-toastify";
import "./AccountRecoVerifiedPage.css";

// Icons
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";
import type { ConfirmRecoveryPayload } from "../../types/auth";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const AccountRecoVerifiedPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const ticketId = location.state?.ticketId;
  const { confirmRecovery, loading: submitLoading } = useAccountRecoVerified();
  const { resend, loading: otpLoading, timer } = useVerifyOtp();
  const isLoading = otpLoading || submitLoading;

  useEffect(() => {
    if (!ticketId) {
      toast.error("Yêu cầu không hợp lệ hoặc phiên làm việc đã hết hạn.");
      navigate("/login");
    }
  }, [ticketId, navigate]);

  const handleSendOtp = async (email: string) => {
    try {
      await resend({ account: email, type: "account-recovery" });
      toast.success(`Mã OTP đã được gửi đến: ${email}`);
    } catch (error) {
      console.error("Send OTP Error", error);
    }
  };

  const handleSubmit = async (formData: RecoVerifiedPayload) => {
    try {
      const payload: ConfirmRecoveryPayload = {
        account: location.state?.email || "", // Lấy trực tiếp từ location state
        code: ticketId,
        newPassword: formData.newPassword,
        confirmNewPassword: formData.confirmNewPassword,
        newEmail: formData.newEmail,
      };

      console.log("Submitting Real Payload:", payload);
      await confirmRecovery(payload);

      toast.success("Khôi phục tài khoản thành công! Vui lòng đăng nhập.");
      navigate("/login");
    } catch (error: unknown) {
      console.error("Submit Error", error);
      const err = error as ApiError;
      const msg =
        err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.";
      toast.error(msg);
    }
  };

  return (
    <div
      className={`reco-verified-page-container ${isCollapsed ? "collapsed" : ""}`}
    >
      {/* Form nhập liệu */}
      <div className="reco-verified-left-section">
        <AccountRecoVerifiedForm
          loading={isLoading}
          timer={timer}
          onSendOtp={handleSendOtp}
          onSubmit={handleSubmit}
          onLoginClick={() => navigate("/login")}
          onRegisterClick={() => navigate("/register")}
        />
      </div>

      {/* Mũi tên thu/mở */}
      <div
        className="reco-verified-arrow-container"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <svg
          className="reco-verified-arrow-icon"
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

      {/* Thông tin lợi ích */}
      <div className="reco-verified-right-section">
        <div className="reco-verified-info-card">
          <h2 className="reco-verified-info-title">Secure & Reset.</h2>
          <p className="reco-verified-info-quote">
            “Securely update your credentials to regain access. We prioritize
            your account safety above all else.”
          </p>
          <ul className="reco-verified-benefit-list">
            <li className="reco-verified-benefit-item">
              <span className="reco-verified-benefit-icon">
                <SearchIcon />
              </span>{" "}
              Update your password securely.
            </li>
            <li className="reco-verified-benefit-item">
              <span className="reco-verified-benefit-icon">
                <FileIcon />
              </span>{" "}
              Link a new email address.
            </li>
            <li className="reco-verified-benefit-item">
              <span className="reco-verified-benefit-icon">
                <CartIcon />
              </span>{" "}
              Verify ownership instantly.
            </li>
            <li className="reco-verified-benefit-item">
              <span className="reco-verified-benefit-icon">
                <HeadsetIcon />
              </span>{" "}
              Regain full account access.
            </li>
          </ul>
          <button
            className="reco-verified-explore-btn"
            onClick={() => navigate("/")}
          >
            Explore
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountRecoVerifiedPage;
