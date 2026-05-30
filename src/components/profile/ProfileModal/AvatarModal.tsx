import { useEffect, useState } from "react";
import "./AvatarModal.css";
import type { UserProfile } from "../../../types/user";

// model user chung (dùng chung type với MyProfile / MyProfilePage)
export type { UserProfile };

// schema form để trả dữ liệu về component cha
export interface AvatarFormData {
  avatar: string; // Data URL
}

interface AvatarModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onSubmit: (data: AvatarFormData) => void;
}

// modal form popup
export default function AvatarModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: AvatarModalProps) {
  // Giữ preview URL để xem trước
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>(initialData?.avatar ?? "");

  // Cập nhật giá trị mỗi khi các prop thay đổi
  useEffect(() => {
    if (!isOpen || !initialData) return;
  }, [isOpen, initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewSrc(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedFile) {
      alert("Please select an avatar image from your computer.");
      return;
    }

    // Lưu avatar vào profile dưới dạng data URL
    onSubmit({
      avatar: previewSrc,
    });
  };

  if (!isOpen) return null;

  const isViewOnly = mode === "view";

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="um-modal-title">
          {mode === "edit" ? "Update Avatar" : "Avatar preview"}
        </h2>

        <form onSubmit={handleFormSubmit} className="um-modal-form">
          <div className="um-form-group">
            <label>Current avatar</label>
            <img
              src={previewSrc || "https://placehold.co/150"}
              alt="Avatar preview"
              className="avatar-preview-img"
            />
          </div>

          <div className="um-form-group">
            <label>
              Choose new avatar <span className="req">*</span>
            </label>
            <input
              name="avatar"
              type="file"
              accept="image/*"
              disabled={isViewOnly}
              onChange={handleFileChange}
            />
          </div>

          <div className="um-modal-actions">
              <>
                <button type="submit" className="um-btn-modal-submit">
                  Save avatar
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
