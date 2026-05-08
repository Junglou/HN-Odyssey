import { useState, useRef, useEffect, type FormEvent } from "react";
import "./CouponModal.css";
import {
  ArrowLeftIcon,
  CloseIcon,
  ChevronDownIcon,
} from "../../../../assets/icons/CouponManagementIcons";
import type {
  CouponRecord,
  CouponFormData,
  DiscountType,
  ApplicableScopeObj,
} from "../../../../hooks/portal/MarketingSuite/CouponManagement/useCouponManagement";

interface CouponModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: CouponRecord | null;
  onClose: () => void;
  onSubmit: (data: CouponFormData) => void;
}

const MOCK_PRODUCTS = [
  { id: "p1", name: "Classic White Shirt" },
  { id: "p2", name: "Grey Slim Jacket" },
  { id: "p3", name: "Denim Jeans" },
  { id: "p4", name: "Running Sneakers" },
];
const MOCK_CATEGORIES = [
  { id: "c1", name: "Home Goods" },
  { id: "c1-1", name: "Kitchenware" },
  { id: "c2", name: "Electronics" },
  { id: "c3", name: "Fashion" },
];
const MOCK_TAGS = [
  { id: "t1", name: "Summer Collection" },
  { id: "t2", name: "New Arrival" },
  { id: "t3", name: "Winter Clearance" },
  { id: "t4", name: "Bestseller" },
];

const defaultFormData: CouponFormData = {
  code: "",
  discountType: "Percentage",
  discountValueNum: "",
  minimumOrderValueNum: "",
  maximumDiscountAmountNum: "",
  totalUsesNum: "",
  perCustomerLimitNum: "",
  startDate: "",
  endDate: "",
  applicableScope: {
    isAllProducts: true,
    categories: [],
    tags: [],
    products: [],
  },
  isDraft: false,
};

const DISCOUNT_OPTIONS = [
  { label: "Percentage - %", value: "Percentage" },
  { label: "Fixed Amount - $", value: "Fixed Amount" },
];

function CustomSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div
      className={`coupon-custom-select ${disabled ? "disabled" : ""}`}
      ref={ref}
    >
      <div
        className={`coupon-select-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <div className={`coupon-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownIcon />
        </div>
      </div>
      <div
        className={`coupon-select-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`coupon-select-item ${value === opt.value ? "selected" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Component dropdown
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

  const filteredOptions = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedValues.includes(opt.name),
  );

  const handleSelect = (name: string) => {
    onChange([...selectedValues, name]);
    setSearch("");
    setIsOpen(false);
  };

  const handleRemove = (name: string) => {
    onChange(selectedValues.filter((v) => v !== name));
  };

  return (
    <div className="coupon-multi-select-container" ref={dropdownRef}>
      {!disabled && (
        <div className="coupon-select-input-wrapper">
          <input
            type="text"
            className="coupon-form-input coupon-select-search"
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
            <div className="coupon-select-dropdown">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="coupon-select-option"
                    onClick={() => handleSelect(opt.name)}
                  >
                    {opt.name}
                  </div>
                ))
              ) : (
                <div className="coupon-select-empty">No matching results</div>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className="coupon-selected-chips"
        style={{ marginTop: selectedValues.length > 0 ? "12px" : "0" }}
      >
        {selectedValues.map((val) => (
          <div key={val} className="coupon-chip-item">
            {val}
            {!disabled && (
              <button
                type="button"
                className="coupon-chip-remove-btn"
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

// Component chính
export default function CouponModal(props: CouponModalProps) {
  const [shouldRender, setShouldRender] = useState(props.isOpen);
  const [isClosing, setIsClosing] = useState(false);

  if (props.isOpen && !shouldRender) {
    setShouldRender(true);
    setIsClosing(false);
  }

  useEffect(() => {
    if (!props.isOpen && shouldRender) {
      const startClosingTimer = setTimeout(() => {
        setIsClosing(true);
      }, 0);

      const unmountTimer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300);

      return () => {
        clearTimeout(startClosingTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [props.isOpen, shouldRender]);

  if (!shouldRender) return null;

  const componentKey = props.mode === "add" ? "add-new" : props.initialData?.id;
  return <ModalContent key={componentKey} {...props} isClosing={isClosing} />;
}

function ModalContent({
  mode,
  initialData,
  onClose,
  onSubmit,
  isClosing,
}: Omit<CouponModalProps, "isOpen"> & { isClosing?: boolean }) {
  // Khởi tạo state
  const [formData, setFormData] = useState<CouponFormData>(() => {
    if ((mode === "edit" || mode === "view") && initialData) {
      const rawValue = initialData.discountValue.replace(/[^0-9.]/g, "");
      return {
        code: initialData.code,
        discountType: initialData.discountType,
        discountValueNum: rawValue,
        minimumOrderValueNum: initialData.minimumOrderValue?.toString() || "",
        maximumDiscountAmountNum:
          initialData.maximumDiscountAmount?.toString() || "",
        totalUsesNum: initialData.totalUses.toString(),
        perCustomerLimitNum: initialData.perCustomerLimit?.toString() || "",
        startDate: initialData.startDate.split("/").reverse().join("-"),
        endDate: initialData.endDate.split("/").reverse().join("-"),
        applicableScope: initialData.applicableScope,
        isDraft: initialData.status === "Draft",
      };
    }
    return defaultFormData;
  });

  const [activeToggles, setActiveToggles] = useState({
    products:
      initialData && initialData.applicableScope.products.length > 0
        ? true
        : false,
    categories:
      initialData && initialData.applicableScope.categories.length > 0
        ? true
        : false,
    tags:
      initialData && initialData.applicableScope.tags.length > 0 ? true : false,
  });

  const isViewMode = mode === "view";
  const title =
    mode === "add"
      ? "Create Coupon"
      : mode === "edit"
        ? "Edit Coupon"
        : "Coupon Details";

  const todayStr = new Date().toISOString().split("T")[0];
  const minStartDate =
    mode === "add"
      ? todayStr
      : initialData?.startDate.split("/").reverse().join("-") || todayStr;

  // Submit form
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    const scope = formData.applicableScope;
    const hasAnyScopeSelected =
      scope.categories.length > 0 ||
      scope.tags.length > 0 ||
      scope.products.length > 0;

    const formattedData = {
      ...formData,
      applicableScope: {
        ...scope,
        isAllProducts: !hasAnyScopeSelected,
      },
      startDate: formData.startDate.split("-").reverse().join("/"),
      endDate: formData.endDate.split("-").reverse().join("/"),
    };
    onSubmit(formattedData);
  };

  // Cập nhật field
  const handleChange = (
    field: keyof CouponFormData,
    value: string | boolean | ApplicableScopeObj,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Cập nhật scope
  const handleScopeChange = (
    field: keyof ApplicableScopeObj,
    value: boolean | string[],
  ) => {
    setFormData((prev) => ({
      ...prev,
      applicableScope: { ...prev.applicableScope, [field]: value },
    }));
  };

  const handleToggleScope = (scopeName: "products" | "categories" | "tags") => {
    if (isViewMode) return;

    setActiveToggles((prev) => {
      const isNowActive = !prev[scopeName];

      if (!isNowActive) {
        handleScopeChange(scopeName, []);
      }

      return { ...prev, [scopeName]: isNowActive };
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`coupon-modal-overlay ${isClosing ? "closing" : ""}`}
        onClick={onClose}
      ></div>
      <div className={`coupon-modal-container ${isClosing ? "closing" : ""}`}>
        <form onSubmit={handleSubmit} className="coupon-modal-form">
          {/* Header */}
          <div className="coupon-modal-header">
            <button
              type="button"
              className="coupon-modal-back-btn"
              onClick={onClose}
            >
              <ArrowLeftIcon />
            </button>
            <h2 className="coupon-modal-title">{title}</h2>
          </div>

          {/* Nội dung form */}
          <div className="coupon-modal-body">
            <div className="coupon-form-group">
              <label className="coupon-form-label">
                Coupon Code <span className="coupon-required">*</span>
              </label>
              <input
                type="text"
                className="coupon-form-input"
                placeholder="Enter Coupon Code"
                value={formData.code}
                onChange={(e) =>
                  handleChange("code", e.target.value.toUpperCase())
                }
                disabled={isViewMode}
              />
            </div>

            <div className="coupon-form-group">
              <label className="coupon-form-label">Discount Type</label>
              <CustomSelect
                value={formData.discountType}
                options={DISCOUNT_OPTIONS}
                onChange={(val) =>
                  handleChange("discountType", val as DiscountType)
                }
                disabled={isViewMode}
              />
            </div>

            <div className="coupon-form-row">
              <div className="coupon-form-col">
                <label className="coupon-form-label">
                  Discount Value <span className="coupon-required">*</span>
                </label>
                <input
                  type="number"
                  className="coupon-form-input"
                  placeholder={
                    formData.discountType === "Percentage"
                      ? "e.g. 20"
                      : "e.g. 10"
                  }
                  value={formData.discountValueNum}
                  onChange={(e) =>
                    handleChange("discountValueNum", e.target.value)
                  }
                  disabled={isViewMode}
                  min="0"
                  step={formData.discountType === "Percentage" ? "1" : "0.01"}
                />
              </div>
              <div className="coupon-form-col">
                <label className="coupon-form-label">Minimum Order Value</label>
                <input
                  type="number"
                  className="coupon-form-input"
                  placeholder="Optional"
                  value={formData.minimumOrderValueNum}
                  onChange={(e) =>
                    handleChange("minimumOrderValueNum", e.target.value)
                  }
                  disabled={isViewMode}
                  min="0"
                />
              </div>
            </div>

            {formData.discountType === "Percentage" && (
              <div className="coupon-form-group">
                <label className="coupon-form-label">
                  Maximum Discount Amount
                </label>
                <input
                  type="number"
                  className="coupon-form-input"
                  placeholder="Optional"
                  value={formData.maximumDiscountAmountNum}
                  onChange={(e) =>
                    handleChange("maximumDiscountAmountNum", e.target.value)
                  }
                  disabled={isViewMode}
                  min="0"
                />
              </div>
            )}

            <div className="coupon-form-group">
              <label className="coupon-form-label">
                Usage Limit <span className="coupon-required">*</span>
              </label>
              <div className="coupon-form-row">
                <input
                  type="number"
                  className="coupon-form-input"
                  placeholder="Total Uses (e.g. 500)"
                  value={formData.totalUsesNum}
                  onChange={(e) => handleChange("totalUsesNum", e.target.value)}
                  disabled={isViewMode}
                  min="1"
                />
                <input
                  type="number"
                  className="coupon-form-input"
                  placeholder="Per Customer (Optional)"
                  value={formData.perCustomerLimitNum}
                  onChange={(e) =>
                    handleChange("perCustomerLimitNum", e.target.value)
                  }
                  disabled={isViewMode}
                  min="1"
                />
              </div>
            </div>

            <div className="coupon-form-row">
              <div className="coupon-form-col">
                <label className="coupon-form-label">
                  Start Date <span className="coupon-required">*</span>
                </label>
                <input
                  type="date"
                  className="coupon-form-input"
                  value={formData.startDate}
                  min={minStartDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  disabled={isViewMode}
                />
              </div>
              <div className="coupon-form-col">
                <label className="coupon-form-label">
                  End Date <span className="coupon-required">*</span>
                </label>
                <input
                  type="date"
                  className="coupon-form-input"
                  value={formData.endDate}
                  min={formData.startDate || todayStr}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  disabled={isViewMode}
                />
              </div>
            </div>

            {/* Phạm vi áp dụng */}
            <div className="coupon-form-group" style={{ marginTop: "8px" }}>
              <label className="coupon-form-label">Applicable Scope</label>

              <div className="coupon-scope-tab-bar">
                <button
                  type="button"
                  className={`coupon-scope-tab-btn ${activeToggles.products ? "active" : ""}`}
                  onClick={() => handleToggleScope("products")}
                  disabled={isViewMode}
                >
                  Product
                </button>
                <button
                  type="button"
                  className={`coupon-scope-tab-btn ${activeToggles.categories ? "active" : ""}`}
                  onClick={() => handleToggleScope("categories")}
                  disabled={isViewMode}
                >
                  Category
                </button>
                <button
                  type="button"
                  className={`coupon-scope-tab-btn ${activeToggles.tags ? "active" : ""}`}
                  onClick={() => handleToggleScope("tags")}
                  disabled={isViewMode}
                >
                  Tag
                </button>
              </div>

              <div className="coupon-dynamic-dropdowns">
                {activeToggles.categories && (
                  <MultiSelectDropdown
                    options={MOCK_CATEGORIES}
                    selectedValues={formData.applicableScope.categories}
                    onChange={(vals) => handleScopeChange("categories", vals)}
                    placeholder="Select Category..."
                    disabled={isViewMode}
                  />
                )}

                {activeToggles.products && (
                  <MultiSelectDropdown
                    options={MOCK_PRODUCTS}
                    selectedValues={formData.applicableScope.products}
                    onChange={(vals) => handleScopeChange("products", vals)}
                    placeholder="Select Product..."
                    disabled={isViewMode}
                  />
                )}

                {activeToggles.tags && (
                  <MultiSelectDropdown
                    options={MOCK_TAGS}
                    selectedValues={formData.applicableScope.tags}
                    onChange={(vals) => handleScopeChange("tags", vals)}
                    placeholder="Select Tag..."
                    disabled={isViewMode}
                  />
                )}
              </div>
            </div>

            {/* Trạng thái */}
            <div className="coupon-status-section">
              <label className="coupon-status-label">Status</label>
              <div className="coupon-toggle-wrapper">
                <label className="coupon-toggle-switch">
                  <input
                    type="checkbox"
                    className="coupon-toggle-input"
                    checked={!formData.isDraft}
                    onChange={(e) => handleChange("isDraft", !e.target.checked)}
                    disabled={isViewMode}
                  />
                  <span className="coupon-toggle-slider"></span>
                </label>
                <span className="coupon-toggle-text">
                  {formData.isDraft ? "Draft" : "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer form */}
          <div className="coupon-modal-footer">
            <div className="coupon-footer-buttons">
              {!isViewMode && (
                <button type="submit" className="coupon-btn-primary">
                  {mode === "add" ? "Create Coupon" : "Save Changes"}
                </button>
              )}
              <button
                type="button"
                className="coupon-btn-secondary"
                onClick={onClose}
              >
                {isViewMode ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
