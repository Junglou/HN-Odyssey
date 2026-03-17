import { useState } from "react";
import "./VariantModal.css";
import { SearchIcon } from "../../../../../assets/icons/AuthIcons";

export interface VariantAttribute {
  id: string;
  name: string;
  values: string[];
}

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAttribute?: VariantAttribute | null;
  availableAttributes: VariantAttribute[];
  existingVariants: VariantAttribute[];
  onConfirm: (attributes: VariantAttribute[]) => void;
}

export default function VariantModal({
  isOpen,
  onClose,
  initialAttribute,
  availableAttributes,
  existingVariants,
  onConfirm,
}: VariantModalProps) {
  const [step, setStep] = useState<"select-attr" | "select-values">(
    "select-attr",
  );

  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [selectedValuesMap, setSelectedValuesMap] = useState<
    Record<string, string[]>
  >({});

  const [searchTerm, setSearchTerm] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // cập nhật state trực tiếp trong quá trình render
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialAttribute) {
        // Nếu là Edit mode: Đặt sẵn ID và mảng giá trị của dòng đang sửa
        setSelectedAttrIds([initialAttribute.id]);
        setSelectedValuesMap({
          [initialAttribute.id]: initialAttribute.values,
        });
        setStep("select-values");
      } else {
        // Nếu là Add mode: Khôi phục lại trạng thái
        setStep("select-attr");

        // Đọc ID từ bảng để tick sẵn thuộc tính
        setSelectedAttrIds(existingVariants.map((v) => v.id));

        // Khôi phục các giá trị (S, M, L) đã tích
        const map: Record<string, string[]> = {};
        existingVariants.forEach((v) => {
          map[v.id] = v.values;
        });
        setSelectedValuesMap(map);

        setSearchTerm("");
      }
    }
  }

  if (!isOpen) return null;

  const filteredAttrs = availableAttributes.filter((attr) =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Click vào thuộc tính
  const handleToggleAttrSelection = (id: string) => {
    setSelectedAttrIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Tích chọn giá trị thuộc tính
  const handleToggleValue = (attrId: string, val: string, checked: boolean) => {
    setSelectedValuesMap((prev) => {
      const currentVals = prev[attrId] || [];
      if (checked) {
        return { ...prev, [attrId]: [...currentVals, val] };
      } else {
        return { ...prev, [attrId]: currentVals.filter((v) => v !== val) };
      }
    });
  };

  // Gom toàn bộ dữ liệu thuộc tính đã chọn thành mảng trả về form
  const handleFinalConfirm = () => {
    const results: VariantAttribute[] = selectedAttrIds.map((id) => {
      // Lấy tên và cấu trúc gốc từ danh sách (ưu tiên availableAttributes, fallback initialAttribute nếu có)
      const attrDef =
        availableAttributes.find((a) => a.id === id) || initialAttribute;
      return {
        id,
        name: attrDef?.name || "",
        values: selectedValuesMap[id] || [],
      };
    });

    onConfirm(results);
    onClose();
  };

  return (
    <div className="vm-modal-overlay" onClick={onClose}>
      <div className="vm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="vm-modal-header">
          <h3 className="vm-modal-title">
            {step === "select-attr"
              ? "Manage Variants options"
              : "Edit variant attribute"}
          </h3>
        </div>

        <div className="vm-modal-body">
          {step === "select-attr" && (
            <>
              <div className="vm-search-wrapper">
                <span
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "10px",
                    color: "#9ca3af",
                  }}
                >
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  className="vm-search-input"
                  placeholder="Search attributes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="vm-attr-list">
                {filteredAttrs.map((attr) => {
                  const isSelected = selectedAttrIds.includes(attr.id);
                  return (
                    <div
                      key={attr.id}
                      // render class selected để tô xanh khi được chọn
                      className={`vm-attr-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleToggleAttrSelection(attr.id)}
                    >
                      <span>{attr.name}</span>
                      {isSelected && <span>✔</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === "select-values" && (
            <div className="vm-step2-container">
              {/* hiển thị ra thành danh sách toàn bộ thuộc tính đã chọn */}
              {selectedAttrIds.map((attrId) => {
                const attrDef =
                  availableAttributes.find((a) => a.id === attrId) ||
                  (initialAttribute?.id === attrId ? initialAttribute : null);
                if (!attrDef) return null;
                const selectedVals = selectedValuesMap[attrId] || [];

                return (
                  <div key={attrId} className="vm-attribute-block">
                    <div className="vm-modal-attribute-name">
                      {attrDef.name}:
                    </div>
                    <div className="vm-checkbox-grid">
                      {attrDef.values.map((val) => (
                        <label key={val} className="vm-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedVals.includes(val)}
                            onChange={(e) =>
                              handleToggleValue(attrId, val, e.target.checked)
                            }
                          />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="vm-modal-footer">
          <button
            type="button"
            className="vm-btn-cancel"
            onClick={() =>
              step === "select-values" && !initialAttribute
                ? setStep("select-attr")
                : onClose()
            }
          >
            {step === "select-values" && !initialAttribute ? "Back" : "Cancel"}
          </button>

          {step === "select-attr" && (
            <button
              type="button"
              className="vm-btn-add"
              disabled={selectedAttrIds.length === 0}
              onClick={() => setStep("select-values")}
            >
              Next
            </button>
          )}

          {step === "select-values" && (
            <button
              type="button"
              className="vm-btn-confirm"
              onClick={handleFinalConfirm}
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
