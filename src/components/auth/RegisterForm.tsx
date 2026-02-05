/* src/components/auth/RegisterForm.tsx */
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { RegisterPayload } from "../../types/auth";
import "./RegisterForm.css";
import { GoogleIcon, FacebookIcon, ZaloIcon } from "../../assets/icons";
import { toast } from "react-toastify";

interface RegisterFormProps {
  onSubmit: (data: RegisterPayload) => void | Promise<void>;
  loading: boolean;
  error: string | null;
  onLoginClick: () => void;
  onSupportClick: () => void; // <--- 1. THÊM PROP NÀY
}

const RegisterForm = ({
  onSubmit,
  loading,
  onLoginClick,
  onSupportClick, // <--- 2. NHẬN PROP TẠI ĐÂY
}: RegisterFormProps) => {
  const [formData, setFormData] = useState<RegisterPayload>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    isSubscribed: false,
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.warning("Mật khẩu nhập lại không khớp!");
      return;
    }
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!strongPasswordRegex.test(formData.password)) {
      toast.error(
        "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&)",
      );
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="register-form-wrapper">
      <h1 className="register-title">Join us today.</h1>
      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={loading}
          style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}
        >
          {/* (Giữ nguyên các input FirstName, LastName...) */}
          <div className="register-input-group">
            <input
              type="text"
              name="firstName"
              className="register-form-input"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>
          <div className="register-input-group">
            <input
              type="text"
              name="lastName"
              className="register-form-input"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>
          <div className="register-input-group">
            <input
              type="email"
              name="email"
              className="register-form-input"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>
          <div className="register-input-group">
            <input
              type="tel"
              name="phoneNumber"
              className="register-form-input"
              placeholder="Phone Number"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>
          <div className="register-input-group">
            <input
              type="password"
              name="password"
              className="register-form-input"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>
          <div className="register-input-group">
            <input
              type="password"
              name="confirmPassword"
              className="register-form-input"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <span className="register-required-mark">*</span>
          </div>

          <div className="register-checkbox-group">
            <label className="register-checkbox-label">
              <input
                type="checkbox"
                name="isSubscribed"
                checked={formData.isSubscribed}
                onChange={handleChange}
              />
              <span className="register-checkbox-text">
                <span>
                  Subscribe to receive updates, offers, and the latest news from
                  us.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="register-btn"
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing" : "Register"}
          </button>
        </fieldset>
      </form>

      <div className="register-secondary-links">
        <span className="register-text-link" onClick={onLoginClick}>
          Already have one.
        </span>

        {/* 3. GẮN SỰ KIỆN ONCLICK TẠI ĐÂY */}
        <span className="register-text-link" onClick={onSupportClick}>
          Need help accessing your account?
        </span>
      </div>

      <div className="register-social-login">
        <button
          type="button"
          className="register-social-icon-btn"
          disabled={loading}
        >
          <GoogleIcon />
        </button>
        <button
          type="button"
          className="register-social-icon-btn"
          disabled={loading}
        >
          <FacebookIcon />
        </button>
        <button
          type="button"
          className="register-social-icon-btn"
          disabled={loading}
        >
          <ZaloIcon />
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
