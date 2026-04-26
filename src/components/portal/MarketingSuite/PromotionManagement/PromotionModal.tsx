import { useState, useRef, useEffect } from "react";
import "./PromotionModal.css";
import {
  ArrowLeftIcon,
  CloseIcon,
} from "../../../../assets/icons/PromotionManagementIcons";
import type {
  PromotionRecord,
  PromotionFormData,
} from "../../../../hooks/portal/MarketingSuite/PromotionManagement/usePromotionManagement";

interface PromotionModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view" | "delete" | null;
  initialData?: PromotionRecord | null;
  onClose: () => void;
  onSubmit?: (data: PromotionFormData) => void;
}
interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

// mock data
const MOCK_PRODUCTS = [
  { id: "p1", name: "Classic White Shirt" },
  { id: "p2", name: "Grey Slim Jacket" },
  { id: "p3", name: "Denim Jeans" },
  { id: "p4", name: "Running Sneakers" },
];
const MOCK_CATEGORIES_TREE: CategoryNode[] = [
  {
    id: "c1",
    name: "Home Goods",
    children: [
      {
        id: "c1-1",
        name: "Kitchenware",
        children: [{ id: "c1-1-1", name: "Pots & Pans" }],
      },
      { id: "c1-2", name: "Furniture" },
    ],
  },
  { id: "c2", name: "Electronics" },
  {
    id: "c3",
    name: "Fashion",
    children: [
      { id: "c3-1", name: "Men's Clothing" },
      { id: "c3-2", name: "Women's Clothing" },
    ],
  },
];
const flattenCategories = (
  nodes: CategoryNode[],
  parentPath = "",
): { id: string; name: string }[] => {
  let result: { id: string; name: string }[] = [];

  for (const node of nodes) {
    // nối tên danh mục cha với danh mục con
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;

    result.push({ id: node.id, name: currentPath });

    // nếu có danh mục con, tiếp tục đệ quy
    if (node.children) {
      result = result.concat(flattenCategories(node.children, currentPath));
    }
  }
  return result;
};
const MOCK_CATEGORIES = flattenCategories(MOCK_CATEGORIES_TREE);
const MOCK_TAGS = [
  { id: "t1", name: "Summer Collection" },
  { id: "t2", name: "New Arrival" },
  { id: "t3", name: "Winter Clearance" },
  { id: "t4", name: "Bestseller" },
];

// component dropdown chọn nhiều item có hỗ trợ tìm kiếm
function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder,
  disabled,
}: {
  options: { id: string; name: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // lọc các tùy chọn chưa được chọn và khớp với từ khóa tìm kiếm
  const filteredOptions = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedValues.includes(opt.name),
  );

  const handleSelect = (name: string) => {
    onChange([...selectedValues, name]);
    setSearch("");
    setIsOpen(false); // ẩn dropdown sau khi chọn để user thấy chip vừa thêm
  };

  const handleRemove = (name: string) => {
    onChange(selectedValues.filter((v) => v !== name));
  };

  return (
    <div className="promo-multi-select-container" ref={dropdownRef}>
      {/* tìm kiếm và dropdown */}
      {!disabled && (
        <div className="promo-select-input-wrapper">
          <input
            type="text"
            className="promo-form-input promo-select-search"
            placeholder={
              selectedValues.length === 0
                ? placeholder
                : "Search to add more..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />
          {isOpen && (
            <div className="promo-select-dropdown">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="promo-select-option"
                    onClick={() => handleSelect(opt.name)}
                  >
                    {opt.name}
                  </div>
                ))
              ) : (
                <div className="promo-select-empty">No matching results</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Danh sách đã chọn */}
      <div
        className="promo-selected-chips"
        style={{ marginTop: selectedValues.length > 0 ? "12px" : "0" }}
      >
        {selectedValues.map((val) => (
          <div key={val} className="promo-chip">
            {val}
            {!disabled && (
              <button
                type="button"
                className="promo-chip-remove"
                onClick={() => handleRemove(val)}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// component bọc ngoài quản lý vòng đời form
export default function PromotionModal(props: PromotionModalProps) {
  if (!props.isOpen || props.mode === "delete") return null;

  const formKey = props.initialData?.id || "new-promo";
  return <PromotionModalContent key={formKey} {...props} />;
}

// component chứa logic form
function PromotionModalContent({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: PromotionModalProps) {
  const isViewMode = mode === "view";

  const [formData, setFormData] = useState<PromotionFormData>(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      const isPercent = initialData.discountValue.includes("%");
      const numValue = initialData.discountValue.replace(/[^0-9.]/g, "");

      return {
        name: initialData.name,
        type: initialData.type,
        discountValueNum: numValue,
        discountType: isPercent ? "%" : "Fixed",
        applicableScopeType: initialData.applicableScopeType,
        applicableScopeValues: initialData.applicableScopeValues || [],
        status: initialData.status,
        startDate: initialData.startDate,
        endDate: initialData.endDate,
        description: initialData.description || "",
      };
    }
    return {
      name: "",
      type: "Discount",
      discountValueNum: "",
      discountType: "%",
      applicableScopeType: "Product",
      applicableScopeValues: [],
      status: "Draft",
      startDate: "",
      endDate: "",
      description: "",
    };
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const minStartDate =
    mode === "add" ? todayStr : initialData?.startDate || todayStr;
  const isPublishedIntent = ["Active", "Scheduled", "Expired"].includes(
    formData.status,
  );

  const getTitle = () => {
    if (mode === "add") return "Create Promotion";
    if (mode === "edit") return "Edit Promotion";
    if (mode === "view") return "Promotion Details";
    return "";
  };

  const handleChange = (
    field: keyof PromotionFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className={`promo-modal-overlay ${isOpen ? "open" : ""}`}
      onClick={onClose}
    >
      <div
        className="promo-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="promo-modal-header">
          <button className="promo-modal-back-btn" onClick={onClose}>
            <ArrowLeftIcon />
          </button>
          <h2 className="promo-modal-title">{getTitle()}</h2>
        </div>

        <div className="promo-modal-body">
          <div className="promo-form-group">
            <label className="promo-form-label">
              Promotion Name{" "}
              {!isViewMode && <span className="promo-required">*</span>}
            </label>
            <input
              type="text"
              className="promo-form-input"
              placeholder="Enter promotion name"
              disabled={isViewMode}
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Promotion Type</label>
            <div className="promo-radio-group">
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="promoType"
                  checked={formData.type === "Discount"}
                  onChange={() => handleChange("type", "Discount")}
                  disabled={isViewMode}
                />
                Discount
              </label>
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="promoType"
                  checked={formData.type === "Flash Sale"}
                  onChange={() => handleChange("type", "Flash Sale")}
                  disabled={isViewMode}
                />
                Flash Sale
              </label>
            </div>
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">
              Promotion Value{" "}
              {!isViewMode && <span className="promo-required">*</span>}
            </label>
            <div className="promo-value-input-group">
              <input
                type="text"
                className="promo-form-input promo-value-number"
                placeholder="Value..."
                disabled={isViewMode}
                value={formData.discountValueNum}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
                  handleChange("discountValueNum", val);
                }}
              />
              <button
                type="button"
                className="promo-value-toggle-btn"
                disabled={isViewMode}
                onClick={() =>
                  handleChange(
                    "discountType",
                    formData.discountType === "%" ? "Fixed" : "%",
                  )
                }
              >
                {formData.discountType}
              </button>
            </div>
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Applicable Scope</label>
            <div className="promo-scope-tabs">
              {(["Product", "Category", "Tag"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`promo-scope-tab ${
                    formData.applicableScopeType === tab ? "active" : ""
                  }`}
                  onClick={() => {
                    if (!isViewMode) {
                      handleChange("applicableScopeType", tab);
                      handleChange("applicableScopeValues", []);
                    }
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <MultiSelectDropdown
              options={
                formData.applicableScopeType === "Product"
                  ? MOCK_PRODUCTS
                  : formData.applicableScopeType === "Category"
                    ? MOCK_CATEGORIES
                    : MOCK_TAGS
              }
              selectedValues={formData.applicableScopeValues}
              onChange={(vals) => handleChange("applicableScopeValues", vals)}
              placeholder={`Search ${formData.applicableScopeType}...`}
              disabled={isViewMode}
            />
          </div>

          <div className="promo-date-picker-row">
            <div className="promo-date-picker-col">
              <label className="promo-form-label">
                Start Date{" "}
                {!isViewMode && <span className="promo-required">*</span>}
              </label>
              <input
                type="date"
                className="promo-form-input"
                value={formData.startDate}
                min={minStartDate}
                onChange={(e) => handleChange("startDate", e.target.value)}
                disabled={isViewMode}
              />
            </div>
            <div className="promo-date-picker-col">
              <label className="promo-form-label">
                End Date{" "}
                {!isViewMode && <span className="promo-required">*</span>}
              </label>
              <input
                type="date"
                className="promo-form-input"
                value={formData.endDate}
                min={formData.startDate || todayStr}
                onChange={(e) => handleChange("endDate", e.target.value)}
                disabled={isViewMode}
              />
            </div>
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Status</label>
            <div className="promo-radio-group">
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === "Draft"}
                  onChange={() => handleChange("status", "Draft")}
                  disabled={isViewMode}
                />
                Draft
              </label>
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="status"
                  checked={isPublishedIntent}
                  onChange={() => handleChange("status", "Active")}
                  disabled={isViewMode}
                />
                Active
              </label>
            </div>
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Description</label>
            <textarea
              className="promo-form-textarea"
              placeholder="Enter Description"
              rows={4}
              disabled={isViewMode}
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="promo-modal-footer">
          <button
            type="button"
            className="promo-btn-secondary"
            onClick={onClose}
          >
            {isViewMode ? "Close" : "Cancel"}
          </button>
          {!isViewMode && (
            <button
              type="button"
              className="promo-btn-primary"
              onClick={() => onSubmit && onSubmit(formData)}
            >
              {mode === "edit" ? "Save Changes" : "Create Promotion"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
