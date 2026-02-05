import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VerifyOtpForm from "../../components/auth/VerifyOtpForm";
import { useVerifyOtp } from "../../hooks/useVerifyOtp";
import { useForgot } from "../../hooks/useForgot";
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

  // Hooks
  const { verify, resend, loading: verifyLoading, timer } = useVerifyOtp();
  const { forgotPassword, loading: forgotLoading } = useForgot();

  // Xác định Loading chung (nếu 1 trong 2 đang load thì hiện loading)
  const isLoading = verifyLoading || forgotLoading;

  // Lấy dữ liệu từ State (từ trang trước gửi sang)
  const emailFromState = location.state?.email || "";
  const type = location.state?.type || "REGISTER"; // Mặc định là Đăng ký

  // Helper check email
  const isEmail = (val: string) => /\S+@\S+\.\S+/.test(val);

  // Nút process
  const handleVerify = async (inputValue: string, otp: string) => {
    // Tạo payload tự động dựa trên input là Email/SĐT
    const payload = isEmail(inputValue)
      ? { email: inputValue, otpCode: otp }
      : { phoneNumber: inputValue, otpCode: otp };

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
    try {
      if (type === "FORGOT_PASSWORD") {
        // Nếu đang ở luồng Quên mật khẩu -> Gọi API quên mật khẩu
        await forgotPassword(inputValue);
        toast.success("Mã OTP khôi phục đã được gửi lại!");
      } else {
        // Nếu đang ở luồng Đăng ký -> Gọi API gửi lại mã kích hoạt
        const payload = isEmail(inputValue)
          ? { email: inputValue }
          : { phoneNumber: inputValue };

        await resend(payload);
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
