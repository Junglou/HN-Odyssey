import { useEffect, useRef } from "react";
import "./AccountInformationModal.css";
import type { UserProfile } from "../../../types/user";

// model user chung (dùng chung type với MyProfile / MyProfilePage)
export type { UserProfile };

// schema form để trả dữ liệu về component cha
export interface AccountFormData {
  username: string;
  password: string;
  email: string;
  phone: string;
}

// Alias cho hook/import cũ dùng tên UserFormData
export type UserFormData = AccountFormData;

interface AccountModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => void;
}

// modal form popup
export default function AccountModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: AccountModalProps) {
  // khởi tạo state form; đồng bộ lại khi mở modal / initialData đổi (xem useEffect)
  // (phiên bản hiện tại dùng uncontrolled input bằng refs để không dùng setFormData)
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  // đổ form từ initialData mỗi khi mở modal hoặc initialData thay đổi
  useEffect(() => {
    if (!isOpen || !initialData) return;
    if (usernameRef.current) usernameRef.current.value = initialData.username ?? "";
    if (passwordRef.current) passwordRef.current.value = initialData.password ?? "";
    if (emailRef.current) emailRef.current.value = initialData.email ?? "";
    if (phoneRef.current) phoneRef.current.value = initialData.phone ?? "";
  }, [isOpen, initialData]);

  // validate trước khi trả data ra ngoài
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const data: AccountFormData = {
      username: String(fd.get("username") ?? ""),
      password: String(fd.get("password") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
    };

    // validate dữ liệu trước khi trả lên cha
    if (
      !data.username?.trim() ||
      !data.password?.trim() ||
      !data.email?.trim() ||
      !data.phone?.trim()
    ) {
      alert("Please fill in all required fields (*)");
      return;
    }
    onSubmit(data);
  };

  if (!isOpen) return null;

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="um-modal-title">
          {mode === "edit" ? "Edit profile" : "Profile details"}
        </h2>

        <form onSubmit={handleFormSubmit} className="um-modal-form">
          {/* các field profile */}
          <div className="um-form-group">
            <label>
              Username <span className="req">*</span>
            </label>
            <input
              name="username"
              type="text"
              ref={usernameRef}
              defaultValue={initialData?.username ?? ""}
              placeholder="Username"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Password <span className="req">*</span>
            </label>
            <input
              name="password"
              type="text"
              ref={passwordRef}
              defaultValue={initialData?.password ?? ""}
              placeholder="Password"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Email <span className="req">*</span>
            </label>
            <input
              name="email"
              type="email"
              ref={emailRef}
              defaultValue={initialData?.email ?? ""}
              placeholder="Email"
              required
            />
          </div>

          <div className="um-form-group">
            <label>Phone</label>
            <input
              name="phone"
              type="text"
              ref={phoneRef}
              defaultValue={initialData?.phone ?? ""}
              placeholder="Phone number"
            />
          </div>

          {/* cụm nút */}
          <div className="um-modal-actions">
              <>
                <button type="submit" className="um-btn-modal-submit">
                  Save changes
                </button>
                <button
                  type="button"
                  className="um-btn-modal-cancel"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </>
          </div>
        </form>
      </div>
    </div>
  );
}
