import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountRecoveryForm from "../../components/auth/AccountRecoveryForm";
import { useAccountRecovery } from "../../hooks/auth/useAccountRecovery";
import { useVerifyOtp } from "../../hooks/auth/useVerifyOtp";
import { toast } from "react-toastify";
import "./AccountRecoveryPage.css";
import type { AccountRecoveryPayload } from "../../types/auth";

// Icon
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";

const AccountRecoveryPage = () => {
  // State quản lý đóng/mở panel trái (Responsive)
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Lấy email được truyền từ trang trước (nếu có)
  const initialEmail = location.state?.email || "";
  const { submitRequest, loading: submitLoading } = useAccountRecovery();
  const { resend, loading: otpLoading, timer } = useVerifyOtp();
  const isLoading = submitLoading || otpLoading;
  const handleSendOtp = async (email: string) => {
    try {
      // Kiểm tra định dạng (Email hay SĐT)
      const isEmail = /\S+@\S+\.\S+/.test(email);

      // Gọi API Resend OTP
      await resend(isEmail ? { email } : { phoneNumber: email });

      toast.success("Mã xác thực đã được gửi! Vui lòng kiểm tra.");
    } catch (error) {
      console.error("Send OTP Error:", error);
      // Lỗi đã được xử lý hiển thị trong hook useVerifyOtp
    }
  };

  // Handler: form yêu cầu hỗ trợ
  const handleSubmit = async (data: AccountRecoveryPayload) => {
    try {
      // Gọi API Gửi yêu cầu hỗ trợ
      await submitRequest(data);
      toast.success("Yêu cầu hỗ trợ đã được gửi thành công!");
      // Thành công -> Quay về trang Login
      navigate("/login");
    } catch (error) {
      console.error("Recovery Request Error:", error);
    }
  };

  return (
    <div
      className={`recovery-page-container ${isCollapsed ? "collapsed" : ""}`}
    >
      {/* Form nhập liệu */}
      <div className="recovery-left-section">
        <AccountRecoveryForm
          initialEmail={initialEmail}
          timer={timer}
          loading={isLoading}
          onSendOtp={handleSendOtp}
          onSubmit={handleSubmit}
          onLoginClick={() => navigate("/login")}
          onRegisterClick={() => navigate("/register")}
        />
      </div>

      {/* Mũi tên thu/mở */}
      <div
        className="recovery-back-arrow-container"
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

      {/* Thông tin lợi ích */}
      <div className="recovery-right-section">
        <div className="recovery-info-card">
          <h2 className="recovery-info-title">No account? No problem.</h2>
          <p className="recovery-info-quote">
            “You don't need an account to get started—explore our products
            freely, choose what fits your needs, and make it yours with ease.”
          </p>

          <ul className="recovery-benefit-list">
            <li className="recovery-benefit-item">
              <span className="recovery-benefit-icon">
                <SearchIcon />
              </span>
              Search and filter products freely...
            </li>
            <li className="recovery-benefit-item">
              <span className="recovery-benefit-icon">
                <FileIcon />
              </span>
              View complete product details...
            </li>
            <li className="recovery-benefit-item">
              <span className="recovery-benefit-icon">
                <CartIcon />
              </span>
              Add items to your cart...
            </li>
            <li className="recovery-benefit-item">
              <span className="recovery-benefit-icon">
                <HeadsetIcon />
              </span>
              Reach out to support anytime...
            </li>
          </ul>

          <button className="recovery-explore-btn">Explore</button>
        </div>
      </div>
    </div>
  );
};

export default AccountRecoveryPage;
