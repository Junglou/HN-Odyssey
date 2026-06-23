import React from "react";
import "./AddressModal.css";
import { ProfileModalPortal } from "../../ProfileModal/ProfileModalPortal";
import type {
  LocationItem,
  AddressFormState,
} from "../../../../hooks/profile/useAddressManagement";

interface AddressModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  // Các props mới lấy từ hook truyền xuống
  formData: AddressFormState;
  provinces: LocationItem[];
  districts: LocationItem[];
  wards: LocationItem[];
  onChange: (field: keyof AddressFormState, value: string | boolean) => void;
}

export default function AddressModal({
  isOpen,
  mode,
  onClose,
  onSubmit,
  formData,
  provinces,
  districts,
  wards,
  onChange,
}: AddressModalProps) {
  if (!isOpen) return null;

  return (
    <ProfileModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="um-modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="um-modal-title">
          {mode === "add"
            ? "Add new address"
            : mode === "edit"
              ? "Edit address"
              : "Address details"}
        </h2>

        {/* Form gọi thẳng hàm onSubmit của hook, hook sẽ lo việc preventDefault và validate */}
        <form onSubmit={onSubmit} className="um-modal-form">
          <div className="um-form-group">
            <label>
              Receiver name <span className="req">*</span>
            </label>
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Receiver name"
              disabled={mode === "view"}
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Phone number <span className="req">*</span>
            </label>
            <input
              name="phone"
              type="text"
              value={formData.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="09xx xxx xxx"
              disabled={mode === "view"}
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Street Address <span className="req">*</span>
            </label>
            <input
              name="street"
              type="text"
              value={formData.street}
              onChange={(e) => onChange("street", e.target.value)}
              placeholder="House number, street name..."
              disabled={mode === "view"}
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Province / City <span className="req">*</span>
            </label>
            <select
              value={formData.provinceCode}
              onChange={(e) => onChange("provinceCode", e.target.value)}
              disabled={mode === "view"}
              required
            >
              <option value="">Select Province / City</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="um-form-group">
            <label>
              District <span className="req">*</span>
            </label>
            <select
              value={formData.districtCode}
              onChange={(e) => onChange("districtCode", e.target.value)}
              disabled={mode === "view" || !formData.provinceCode}
              required
            >
              <option value="">Select District</option>
              {districts.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="um-form-group">
            <label>
              Ward / Commune <span className="req">*</span>
            </label>
            <select
              value={formData.wardCode}
              onChange={(e) => onChange("wardCode", e.target.value)}
              disabled={mode === "view" || !formData.districtCode}
              required
            >
              <option value="">Select Ward / Commune</option>
              {wards.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cụm Checkbox đã gỡ bỏ inline-style */}
          <div className="um-form-group um-checkbox-group">
            <input
              type="checkbox"
              id="isDefaultAddress"
              className="um-checkbox-input"
              checked={formData.isDefault}
              onChange={(e) => onChange("isDefault", e.target.checked)}
              disabled={mode === "view"}
            />
            <label htmlFor="isDefaultAddress" className="um-checkbox-label">
              Set as default address
            </label>
          </div>

          <div className="um-modal-actions">
            {mode !== "view" && (
              <button type="submit" className="um-btn-modal-submit">
                {mode === "add" ? "Add address" : "Save changes"}
              </button>
            )}
            <button
              type="button"
              className="um-btn-modal-cancel"
              onClick={onClose}
            >
              {mode === "view" ? "Close" : "Cancel"}
            </button>
          </div>
        </form>
      </div>
    </ProfileModalPortal>
  );
}
