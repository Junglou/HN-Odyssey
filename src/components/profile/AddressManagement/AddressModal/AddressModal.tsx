import { useEffect, useRef } from "react";
import "./AddressModal.css";
import type { UserAddress } from "../../../../types/user";

export type { UserAddress };

// schema form để trả dữ liệu về component cha
export interface AddressFormData {
  receiverName: string;
  address: string;
  city: string;
  country: string;
}

interface AddressModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: UserAddress | null;
  onClose: () => void;
  onSubmit: (data: AddressFormData) => void;
}

// modal form popup
export default function AddressModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: AddressModalProps) {
  // khởi tạo state form; đồng bộ lại khi mở modal / initialData đổi (xem useEffect)
  // (phiên bản hiện tại dùng uncontrolled input bằng refs để không dùng setFormData)
  const receiverNameRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const countryRef = useRef<HTMLInputElement | null>(null);

  // đổ form từ initialData mỗi khi mở modal hoặc initialData thay đổi
  useEffect(() => {
    if (!isOpen) return;

    // Nếu là mode add, xóa các input
    if (mode === "add") {
      if (receiverNameRef.current) receiverNameRef.current.value = "";
      if (addressRef.current) addressRef.current.value = "";
      if (cityRef.current) cityRef.current.value = "";
      if (countryRef.current) countryRef.current.value = "";
      return;
    }

    // Nếu là mode edit hoặc view, populate dữ liệu từ initialData
    if (!initialData) return;
    if (receiverNameRef.current) receiverNameRef.current.value = initialData.receiverName ?? "";
    if (addressRef.current) addressRef.current.value = initialData.address ?? "";
    if (cityRef.current) cityRef.current.value = initialData.city ?? "";
    if (countryRef.current) countryRef.current.value = initialData.country ?? "";
  }, [isOpen, initialData, mode]);

  // validate trước khi trả data ra ngoài
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const data: AddressFormData = {
      receiverName: String(fd.get("receiverName") ?? ""),
      address: String(fd.get("address") ?? ""),
      city: String(fd.get("city") ?? ""),
      country: String(fd.get("country") ?? ""),
    };

    // validate dữ liệu trước khi trả lên cha
    if (
      !data.receiverName?.trim() ||
      !data.address?.trim() ||
      !data.city?.trim() ||
      !data.country?.trim()
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
          {mode === "add" ? "Add new address" : mode === "edit" ? "Edit address" : "Address details"}
        </h2>

        <form onSubmit={handleFormSubmit} className="um-modal-form">
          {/* các field profile */}
          <div className="um-form-group">
            <label>
              Receiver name <span className="req">*</span>
            </label>
            <input
              name="receiverName"
              type="text"
              ref={receiverNameRef}
              defaultValue={initialData?.receiverName ?? ""}
              placeholder="Receiver name"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Address <span className="req">*</span>
            </label>
            <input
              name="address"
              type="text"
              ref={addressRef}
              defaultValue={initialData?.address ?? ""}
              placeholder="Address"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              City <span className="req">*</span>
            </label>
            <input
              name="city"
              type="text"
              ref={cityRef}
              defaultValue={initialData?.city ?? ""}
              placeholder="City"
              required
            />
          </div>

          <div className="um-form-group">
            <label>
              Country <span className="req">*</span>
            </label>
            <input
              name="country"
              type="text"
              ref={countryRef}
              defaultValue={initialData?.country ?? ""}
              placeholder="Country"
              required
            />
          </div>

          {/* cụm nút */}
          <div className="um-modal-actions">
              <>
                <button type="submit" className="um-btn-modal-submit">
                  {mode === "add" ? "Add address" : "Save changes"}
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
