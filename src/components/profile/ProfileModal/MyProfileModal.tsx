import { useEffect, useRef } from "react";
import "./MyProfileModal.css";
import type { UserProfile } from "../../../types/user";

// model user chung (dùng chung type với MyProfile / MyProfilePage)
export type { UserProfile };

// schema form để trả dữ liệu về component cha
export interface UserProfileFormData {
  firstName: string;
  lastName: string;
  gender: UserProfile["gender"];
  birthday: string;
  displayName: string;
}

// Alias cho hook/import cũ dùng tên UserFormData
export type UserFormData = UserProfileFormData;

interface MyProfileModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onSubmit: (data: UserProfileFormData) => void;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

// modal form popup
export default function MyProfileModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: MyProfileModalProps) {
  // khởi tạo state form; đồng bộ lại khi mở modal / initialData đổi (xem useEffect)
  // (phiên bản hiện tại dùng uncontrolled input bằng refs để không dùng setFormData)
  const firstNameRef = useRef<HTMLInputElement | null>(null);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const displayNameRef = useRef<HTMLInputElement | null>(null);
  const birthdayRef = useRef<HTMLInputElement | null>(null);
  const genderRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // đổ form từ initialData mỗi khi mở modal hoặc initialData thay đổi
  useEffect(() => {
    if (!isOpen || !initialData) return;
    if (firstNameRef.current) firstNameRef.current.value = initialData.firstName ?? "";
    if (lastNameRef.current) lastNameRef.current.value = initialData.lastName ?? "";
    if (displayNameRef.current) {
      displayNameRef.current.value = initialData.displayName ?? "";
    }
    if (birthdayRef.current) birthdayRef.current.value = initialData.birthday ?? "";

    GENDER_OPTIONS.forEach((g) => {
      if (genderRefs.current[g]) {
        genderRefs.current[g]!.checked = initialData.gender === g;
      }
    });
  }, [isOpen, initialData]);

  // validate trước khi trả data ra ngoài
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const genderRaw = String(fd.get("gender") ?? "");
    const gender: UserProfile["gender"] = (
      GENDER_OPTIONS as readonly string[]
    ).includes(genderRaw)
      ? (genderRaw as UserProfile["gender"])
      : (initialData?.gender ?? "Male");

    const data: UserProfileFormData = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      gender,
      birthday: String(fd.get("birthday") ?? ""),
      displayName: String(fd.get("displayName") ?? ""),
    };

    // validate dữ liệu trước khi trả lên cha
    if (
      !data.firstName?.trim() ||
      !data.lastName?.trim() ||
      !data.displayName?.trim()
    ) {
      alert("Please fill in all required fields (*)");
      return;
    }
    onSubmit(data);
  };

  if (!isOpen) return null;

  // check flag để vô hiệu hóa input
  const isViewOnly = mode === "view";

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
              First name <span className="req">*</span>
            </label>
            <input
              name="firstName"
              type="text"
              ref={firstNameRef}
              defaultValue={initialData?.firstName ?? ""}
              disabled={isViewOnly}
              placeholder="First name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Last name <span className="req">*</span>
            </label>
            <input
              name="lastName"
              type="text"
              ref={lastNameRef}
              defaultValue={initialData?.lastName ?? ""}
              disabled={isViewOnly}
              placeholder="Last name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Display name <span className="req">*</span>
            </label>
            <input
              name="displayName"
              type="text"
              ref={displayNameRef}
              defaultValue={initialData?.displayName ?? ""}
              disabled={isViewOnly}
              placeholder="Display name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>Birthday</label>
            <input
              name="birthday"
              type="text"
              ref={birthdayRef}
              defaultValue={initialData?.birthday ?? ""}
              disabled={isViewOnly}
              placeholder="DD/MM/YYYY"
            />
          </div>

          {/* cụm Gender: radio (không phải dropdown menu) */}
          <div className="um-form-group">
            <span className="um-modal-field-label">Gender</span>
            <div
              className={`um-modal-gender-options ${isViewOnly ? "is-disabled" : ""}`}
              role="radiogroup"
              aria-label="Gender"
            >
              {GENDER_OPTIONS.map((g) => (
                <label key={g} className="um-modal-gender-label">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    ref={(el) => {
                      genderRefs.current[g] = el;
                    }}
                    defaultChecked={initialData?.gender === g}
                    disabled={isViewOnly}
                  />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>

          {/* cụm nút */}
          <div className="um-modal-actions">
            {!isViewOnly ? (
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
    </div>
  );
}
