import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import tokenStorage from "../../../utils/tokenStorage";
import { ProfileModalPortal } from "./ProfileModalPortal";
import "./profileModal.shared.css";
import "./AccountInformationModal.css";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // false = tài khoản Google/Facebook chưa có mật khẩu -> chế độ "Set password"
  hasPassword: boolean;
  onPasswordSet?: () => void;
}

// Lấy thông báo lỗi từ lỗi đã chuẩn hóa của axiosClient (message có thể là mảng khi validate)
const getErrorText = (err: unknown): string => {
  const message = (err as { message?: unknown })?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message) return message;
  return "Could not save password. Please try again.";
};

export default function ChangePasswordModal({
  isOpen,
  onClose,
  hasPassword,
  onPasswordSet,
}: ChangePasswordModalProps) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isSetMode = !hasPassword;

  const resetAndClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if ((!isSetMode && !currentPassword) || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (!isSetMode && newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      if (isSetMode) {
        // Đặt mật khẩu lần đầu: giữ đăng nhập, chỉ cập nhật trạng thái trên trang
        await axiosClient.patch("/users/customers/set-password", {
          newPassword,
        });
        toast.success(
          "Password set. You can now also sign in with your email and password.",
        );
        onPasswordSet?.();
        resetAndClose();
      } else {
        await axiosClient.patch("/users/customers/change-password", {
          currentPassword,
          newPassword,
        });
        // Backend đã thu hồi mọi phiên (kể cả máy này) -> đăng xuất và đăng nhập lại
        tokenStorage.clearAuth();
        toast.success(
          "Password changed. Please sign in again with your new password.",
        );
        navigate("/login", { replace: true });
      }
    } catch (err: unknown) {
      setError(getErrorText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProfileModalPortal isOpen={isOpen} onClose={resetAndClose}>
      <div
        className="um-modal-box account-info-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="um-modal-title">
          {isSetMode ? "Set password" : "Change password"}
        </h2>

        <div className="um-modal-form">
          {isSetMode ? (
            <p className="account-field-hint">
              Your account was created with Google or Facebook and has no
              password yet. Set one to also sign in with your email.
            </p>
          ) : (
            <div className="um-form-group">
              <label>
                Current password <span className="req">*</span>
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="um-form-group">
            <label>
              New password <span className="req">*</span>
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="um-form-group">
            <label>
              Confirm new password <span className="req">*</span>
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
            {!isSetMode ? (
              <p className="account-field-hint">
                After changing your password, you will be signed out on all
                devices, including this one.
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              className="account-field-hint"
              role="alert"
              style={{ color: "#d93025" }}
            >
              {error}
            </p>
          ) : null}

          <div className="um-modal-actions">
            <button
              type="button"
              className="um-btn-modal-cancel"
              onClick={resetAndClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="um-btn-modal-submit"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : isSetMode
                  ? "Set password"
                  : "Change password"}
            </button>
          </div>
        </div>
      </div>
    </ProfileModalPortal>
  );
}
