import { useEffect, useRef } from "react";
import "./MyProfileModal.css";
import { ProfileModalPortal } from "./ProfileModalPortal";
import type { UserProfile } from "../../../types/user";

export type { UserProfile };

export interface UserProfileFormData {
  firstName: string;
  lastName: string;
  gender: UserProfile["gender"];
  birthday: string;
}

export type UserFormData = UserProfileFormData;

interface MyProfileModalProps {
  isOpen: boolean;
  mode: "edit" | "view";
  initialData: UserProfile | null;
  onClose: () => void;
  onSubmit: (data: UserProfileFormData) => void;
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

const formatDateOfBirth = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return "";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function MyProfileModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: MyProfileModalProps) {
  const firstNameRef = useRef<HTMLInputElement | null>(null);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const birthdayRef = useRef<HTMLInputElement | null>(null);
  const genderRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isOpen || !initialData) return;

    if (firstNameRef.current) {
      firstNameRef.current.value = initialData.first_Name ?? "";
    }
    if (lastNameRef.current) {
      lastNameRef.current.value = initialData.last_Name ?? "";
    }
    if (birthdayRef.current) {
      birthdayRef.current.value = formatDateOfBirth(initialData.dateOfBirth);
    }

    GENDER_OPTIONS.forEach(({ value }) => {
      if (genderRefs.current[value]) {
        genderRefs.current[value]!.checked = initialData.gender === value;
      }
    });
  }, [isOpen, initialData]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const genderRaw = String(fd.get("gender") ?? "");
    const gender: UserProfile["gender"] = GENDER_OPTIONS.some(
      (option) => option.value === genderRaw,
    )
      ? (genderRaw as UserProfile["gender"])
      : (initialData?.gender ?? "OTHER");

    const data: UserProfileFormData = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      gender,
      birthday: String(fd.get("birthday") ?? ""),
    };

    if (!data.firstName.trim() || !data.lastName.trim()) {
      alert("Please fill in all required fields (*)");
      return;
    }

    onSubmit(data);
  };

  if (!isOpen) return null;

  const isViewOnly = mode === "view";

  return (
    <ProfileModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="um-modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="um-modal-title">
          {mode === "edit" ? "Edit profile" : "Profile details"}
        </h2>

        <form onSubmit={handleFormSubmit} className="um-modal-form">
          <div className="um-form-group">
            <label>
              First name <span className="req">*</span>
            </label>
            <input
              name="firstName"
              type="text"
              ref={firstNameRef}
              defaultValue={initialData?.first_Name ?? ""}
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
              defaultValue={initialData?.last_Name ?? ""}
              disabled={isViewOnly}
              placeholder="Last name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>Birthday</label>
            <input
              name="birthday"
              type="text"
              ref={birthdayRef}
              defaultValue={formatDateOfBirth(initialData?.dateOfBirth ?? null)}
              disabled={isViewOnly}
              placeholder="DD/MM/YYYY"
            />
          </div>

          <div className="um-form-group">
            <span className="um-modal-field-label">Gender</span>
            <div
              className={`um-modal-gender-options ${isViewOnly ? "is-disabled" : ""}`}
              role="radiogroup"
              aria-label="Gender"
            >
              {GENDER_OPTIONS.map(({ value, label }) => (
                <label key={value} className="um-modal-gender-label">
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    ref={(el) => {
                      genderRefs.current[value] = el;
                    }}
                    defaultChecked={initialData?.gender === value}
                    disabled={isViewOnly}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

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
    </ProfileModalPortal>
  );
}
