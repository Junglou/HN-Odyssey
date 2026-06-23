import { useEffect, useState } from "react";
import "./AvatarModal.css";
import { ProfileModalPortal } from "./ProfileModalPortal";
import type { UserProfile } from "../../../types/user";

export type { UserProfile };

export interface AvatarFormData {
  file: File;
}

interface AvatarModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onSubmit: (data: AvatarFormData) => void;
}

const getFullAvatarPreviewUrl = (avatar: string | null | undefined): string => {
  if (!avatar) return "";
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;

  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "";

  return `${baseUrl}${avatar.startsWith("/") ? avatar : `/${avatar}`}`;
};

export default function AvatarModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: AvatarModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);

  // theo dõi props isOpen để reset state mà không cần dùng useEffect
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      // reset dữ liệu nháp khi modal vừa mở lên
      setSelectedFile(null);
      setObjectPreviewUrl(null);
    }
  }

  // tính toán trực tiếp ảnh preview, không cần lưu thừa một state cho previewSrc
  const previewSrc =
    objectPreviewUrl || getFullAvatarPreviewUrl(initialData?.avatar);

  // cleanup URL để tránh rò rỉ bộ nhớ khi component unmount hoặc khi chọn ảnh khác
  useEffect(() => {
    return () => {
      if (objectPreviewUrl) URL.revokeObjectURL(objectPreviewUrl);
    };
  }, [objectPreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setObjectPreviewUrl(null);
      return;
    }

    if (
      !["image/jpeg", "image/jpg", "image/png"].includes(
        file.type.toLowerCase(),
      )
    ) {
      alert("Please choose a JPG or PNG image.");
      e.target.value = "";
      setSelectedFile(null);
      setObjectPreviewUrl(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be 5 MB or smaller.");
      e.target.value = "";
      setSelectedFile(null);
      setObjectPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    setObjectPreviewUrl(URL.createObjectURL(file));
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedFile) {
      alert("Please select an avatar image from your computer.");
      return;
    }

    onSubmit({ file: selectedFile });
  };

  if (!isOpen) return null;

  const isViewOnly = mode === "view";

  return (
    <ProfileModalPortal isOpen={isOpen} onClose={onClose}>
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
              accept="image/jpeg,image/png,image/jpg"
              disabled={isViewOnly}
              onChange={handleFileChange}
            />
          </div>

          <div className="um-modal-actions">
            {!isViewOnly ? (
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
            ) : (
              <button
                type="button"
                className="um-btn-modal-cancel"
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </ProfileModalPortal>
  );
}
