import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegister, type ApiError } from "../../hooks/useRegister";
import type { RegisterPayload } from "../../types/auth";
import RegisterForm from "../../components/auth/RegisterForm";
import { toast } from "react-toastify";
import "./RegisterPage.css";

// icons
import {
  SearchIcon,
  FileIcon,
  CartIcon,
  HeadsetIcon,
} from "../../assets/icons/AuthIcons";

const RegisterPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { register, loading, error } = useRegister();

  const handleRegister = async (formData: RegisterPayload) => {
    try {
      // Gọi API đăng ký và nhận kết quả trả về
      const response = await register(formData);

      toast.success("Đăng ký thành công! Vui lòng kiểm tra mã xác thực.");

      // Chuyển hướng sang trang Verify OTP
      navigate("/verify-otp", {
        state: {
          email: formData.email,
          account: response?.account, // Lấy account từ BE trả về (nếu có)
        },
      });
    } catch (err: unknown) {
      // Ép kiểu lỗi tùy chỉnh để lấy message
      const apiError = err as ApiError;

      // Nếu lỗi là "Account exists" thì có thể gợi ý về trang login
      toast.error(apiError.message || "Đăng ký thất bại");
    }
  };

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
          /* BỔ SUNG: Truyền hàm điều hướng Support */
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
        {/* Giữ layout */}
        <div className="register-info-card">
          <h2 className="register-info-title">No account? No problem.</h2>
          <p className="register-info-quote">
            “You don't need an account to get started...”
          </p>
          <ul className="register-benefit-list">
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <SearchIcon />
              </span>{" "}
              Search and filter products freely...
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <FileIcon />
              </span>{" "}
              View complete product details...
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <CartIcon />
              </span>{" "}
              Add items to your cart...
            </li>
            <li className="register-benefit-item">
              <span className="register-benefit-icon">
                <HeadsetIcon />
              </span>{" "}
              Reach out to support anytime...
            </li>
          </ul>

          {/* BỔ SUNG: Gắn link Explore về trang chủ */}
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
