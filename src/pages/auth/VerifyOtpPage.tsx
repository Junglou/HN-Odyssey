import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VerifyOtpForm from "../../components/auth/VerifyOtpForm";
import { useVerifyOtp } from "../../hooks/auth/useVerifyOtp";
import { toast } from "react-toastify";
import "./VerifyOtpPage.css";

// icons
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";

const VerifyOtpPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hooks xử lý logic
  const { verify, resend, loading: verifyLoading, timer } = useVerifyOtp();

  // Xác định Loading chung (nếu 1 trong 2 đang load thì hiện loading)
  const isLoading = verifyLoading;

  // Lấy dữ liệu từ State (từ trang trước gửi sang)
  const emailFromState = location.state?.email || "";
  const type = location.state?.type || "REGISTER"; // Mặc định là Đăng ký

  // Nút process
  const handleVerify = async (inputValue: string, otp: string) => {
    // Tạo payload tự động dựa trên input là Email/SĐT
    const payload = {
      account: inputValue, // BE nhận chung cả Email/SĐT vào biến 'account'
      code: otp, // BE dùng tên biến là 'code' thay vì 'otpCode'

      // Chuyển đổi trạng thái từ FE ("FORGOT_PASSWORD") sang chuẩn của BE ("RESET_PASSWORD")
      type: type === "FORGOT_PASSWORD" ? "RESET_PASSWORD" : "REGISTER",
    };

    try {
      await verify(payload);
      // --- LOGIC NGÃ BA ĐƯỜNG (ROUTING) ---
      if (type === "FORGOT_PASSWORD") {
        // Nhánh 1: Quên mật khẩu -> Sang trang Đặt lại mật khẩu
        toast.success("Xác thực thành công! Vui lòng đặt lại mật khẩu.");

        navigate("/reset-password", {
          state: {
            identifier: inputValue, // Email hoặc SĐT đã verify
            otpCode: otp, // Kèm mã OTP làm bằng chứng
          },
        });
      } else {
        // Nhánh 2: Đăng ký (Register) -> Về Login
        toast.success("Kích hoạt tài khoản thành công! Hãy đăng nhập.");
        navigate("/login");
      }
    } catch (error) {
      console.error("Verify Error:", error);
      // Toast lỗi thường đã được xử lý trong hook useVerifyOtp,
      // nếu chưa thì bạn có thể thêm toast.error tại đây.
    }
  };

  // Nút Resend
  const handleResendRequest = async (inputValue: string) => {
    // Tạo payload chuẩn khớp 100% với ResendOtpDto
    const payload = {
      account: inputValue,
      type: type === "FORGOT_PASSWORD" ? "RESET_PASSWORD" : "REGISTER",
    };

    try {
      // Dùng chung API resend cho cả Đăng ký và Quên mật khẩu
      await resend(payload);

      if (type === "FORGOT_PASSWORD") {
        toast.success("Mã OTP khôi phục đã được gửi lại!");
      } else {
        toast.success("Mã kích hoạt đã được gửi lại!");
      }
    } catch (error) {
      console.error("Resend Error:", error);
    }
  };

  // Chuyển về trang Quên mật khẩu
  const handleHelpClick = () => {
    // Điều hướng sang trang Khôi phục tài khoản (Account Recovery)
    navigate("/account-recovery", {
      state: {
        email: emailFromState, // Truyền email sang form bên kia để tiện cho user
      },
    });
  };

  return (
    <div className={`verify-page-container ${isCollapsed ? "collapsed" : ""}`}>
      {/* Khung trái (Form nhập) */}
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

      {/* Mũi tên thu gọn */}
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

      {/* Khung phải (Benefit / Info) */}
      <div className="verify-right-section">
        <div className="verify-info-card">
          {/* Đổi tiêu đề động dựa trên Type */}
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
