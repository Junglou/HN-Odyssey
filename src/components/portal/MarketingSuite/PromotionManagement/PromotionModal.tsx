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
import axiosClient from "../../../../api/axiosClient";
import { toast } from "react-toastify";

interface PromotionModalProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view" | "delete" | null;
  initialData?: PromotionRecord | null;
  onClose: () => void;
  onSubmit?: (data: PromotionFormData) => void;
}

interface ScopeOption {
  id: string;
  name: string;
}

// Bổ sung Interface để giải quyết triệt để lỗi ESLint "Unexpected any"
interface BEProduct {
  _id: string;
  name: string;
}

interface BECategory {
  _id: string;
  name: string;
  children?: BECategory[];
}

interface BETag {
  _id: string;
  name: string;
}

// Hàm đệ quy làm phẳng cây Danh mục từ BE
const flattenCategories = (
  nodes: BECategory[],
  parentPath = "",
): ScopeOption[] => {
  let result: ScopeOption[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    // Chú ý: Backend mongoose trả về _id
    result.push({ id: node._id, name: currentPath });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCategories(node.children, currentPath));
    }
  }
  return result;
};

// Component MultiSelectDropdown đã được cấu trúc lại để lưu ID nhưng hiển thị Name
function MultiSelectDropdown({
  options,
  selectedValues, // Chứa mảng ID
  onChange,
  placeholder,
  disabled,
  isLoading,
}: {
  options: ScopeOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  isLoading?: boolean;
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

  // Ẩn đi những lựa chọn đã có ID trong danh sách selectedValues
  const filteredOptions = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedValues.includes(opt.id),
  );

  const handleSelect = (id: string) => {
    onChange([...selectedValues, id]);
    setSearch("");
    setIsOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(selectedValues.filter((v) => v !== id));
  };

  return (
    <div className="promo-multi-select-container" ref={dropdownRef}>
      {!disabled && (
        <div className="promo-select-input-wrapper">
          <input
            type="text"
            className="promo-form-input promo-select-search"
            placeholder={
              isLoading
                ? "Đang tải dữ liệu..."
                : selectedValues.length === 0
                  ? placeholder
                  : "Tìm kiếm để thêm..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => {
              if (!isLoading) setIsOpen(true);
            }}
            disabled={isLoading}
          />
          {isOpen && !isLoading && (
            <div className="promo-select-dropdown">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="promo-select-option"
                    onClick={() => handleSelect(opt.id)}
                  >
                    {opt.name}
                  </div>
                ))
              ) : (
                <div className="promo-select-empty">Không tìm thấy kết quả</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Đã xóa style inline, sử dụng className has-items thay thế */}
      <div
        className={`promo-selected-chips ${selectedValues.length > 0 ? "has-items" : ""}`}
      >
        {selectedValues.map((idVal) => {
          // Ánh xạ ID ngược lại thành Name để hiển thị cho UI đẹp
          const matchedOpt = options.find((o) => o.id === idVal);
          const displayName = matchedOpt ? matchedOpt.name : idVal;

          return (
            <div key={idVal} className="promo-chip">
              {displayName}
              {!disabled && (
                <button
                  type="button"
                  className="promo-chip-remove"
                  onClick={() => handleRemove(idVal)}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Modal Wrapper
export default function PromotionModal(props: PromotionModalProps) {
  const [shouldRender, setShouldRender] = useState(props.isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  if (props.isOpen && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    let animTimer: ReturnType<typeof setTimeout>;
    let unmountTimer: ReturnType<typeof setTimeout>;

    if (props.isOpen) {
      animTimer = setTimeout(() => setIsAnimating(true), 10);
    } else if (shouldRender) {
      animTimer = setTimeout(() => setIsAnimating(false), 0);
      unmountTimer = setTimeout(() => setShouldRender(false), 300);
    }

    return () => {
      clearTimeout(animTimer);
      clearTimeout(unmountTimer);
    };
  }, [props.isOpen, shouldRender]);

  if (!shouldRender || props.mode === "delete") return null;

  const formKey = props.initialData?.id || "new-promo";
  return (
    <PromotionModalContent key={formKey} {...props} isAnimating={isAnimating} />
  );
}

// Modal Content chính
function PromotionModalContent({
  mode,
  initialData,
  onClose,
  onSubmit,
  isAnimating,
}: PromotionModalProps & { isAnimating?: boolean }) {
  const isViewMode = mode === "view";

  const [products, setProducts] = useState<ScopeOption[]>([]);
  const [categories, setCategories] = useState<ScopeOption[]>([]);
  const [tags, setTags] = useState<ScopeOption[]>([]);
  const [isLoadingScopes, setIsLoadingScopes] = useState(false);

  // Fetch dữ liệu thật từ DB cho Dropdown
  useEffect(() => {
    if (mode === "add" || mode === "edit") {
      const fetchScopeData = async () => {
        setIsLoadingScopes(true);
        try {
          const [prodRes, catRes, tagRes] = await Promise.all([
            axiosClient.get("/products?limit=1000"),
            axiosClient.get("/categories/admin/tree-view"),
            axiosClient.get("/tags?limit=1000"),
          ]);

          // Ép kiểu chuẩn để loại bỏ lỗi ESLint
          const fetchedProducts: BEProduct[] =
            prodRes.data?.data?.data || prodRes.data?.data || [];
          const fetchedCategories: BECategory[] =
            catRes.data?.data || catRes.data || [];
          const fetchedTags: BETag[] = tagRes.data?.data || tagRes.data || [];

          setProducts(
            fetchedProducts.map((p) => ({ id: p._id, name: p.name })),
          );
          setCategories(flattenCategories(fetchedCategories));
          setTags(fetchedTags.map((t) => ({ id: t._id, name: t.name })));
        } catch (error) {
          console.error("Lỗi khi tải dữ liệu Scope:", error);
          toast.error("Lỗi khi tải danh sách Sản phẩm / Danh mục.");
        } finally {
          setIsLoadingScopes(false);
        }
      };

      fetchScopeData();
    }
  }, [mode]);

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
    if (mode === "add") return "Tạo Khuyến mãi";
    if (mode === "edit") return "Chỉnh sửa Khuyến mãi";
    if (mode === "view") return "Chi tiết Khuyến mãi";
    return "";
  };

  const handleChange = (
    field: keyof PromotionFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Xác định options nào sẽ được truyền vào Dropdown dựa trên loại Scope đang chọn
  const currentScopeOptions =
    formData.applicableScopeType === "Product"
      ? products
      : formData.applicableScopeType === "Category"
        ? categories
        : tags;

  return (
    <div
      className={`promo-modal-overlay ${isAnimating ? "open" : ""}`}
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
              Tên chương trình{" "}
              {!isViewMode && <span className="promo-required">*</span>}
            </label>
            <input
              type="text"
              className="promo-form-input"
              placeholder="Nhập tên chương trình"
              disabled={isViewMode}
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Loại khuyến mãi</label>
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
              Mức giảm{" "}
              {!isViewMode && <span className="promo-required">*</span>}
            </label>
            <div className="promo-value-input-group">
              <input
                type="text"
                className="promo-form-input promo-value-number"
                placeholder="Giá trị giảm..."
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
            <label className="promo-form-label">Phạm vi áp dụng</label>
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
              options={currentScopeOptions}
              selectedValues={formData.applicableScopeValues}
              onChange={(vals) => handleChange("applicableScopeValues", vals)}
              placeholder={`Tìm kiếm ${formData.applicableScopeType}...`}
              disabled={isViewMode}
              isLoading={isLoadingScopes}
            />
          </div>

          <div className="promo-date-picker-row">
            <div className="promo-date-picker-col">
              <label className="promo-form-label">
                Ngày bắt đầu{" "}
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
                Ngày kết thúc{" "}
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
            <label className="promo-form-label">Trạng thái</label>
            <div className="promo-radio-group">
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === "Draft"}
                  onChange={() => handleChange("status", "Draft")}
                  disabled={isViewMode}
                />
                Bản nháp (Draft)
              </label>
              <label className="promo-radio-label">
                <input
                  type="radio"
                  name="status"
                  checked={isPublishedIntent}
                  onChange={() => handleChange("status", "Active")}
                  disabled={isViewMode}
                />
                Công bố (Active/Scheduled)
              </label>
            </div>
          </div>

          <div className="promo-form-group">
            <label className="promo-form-label">Description</label>
            <textarea
              className="promo-form-textarea"
              placeholder="Nhập mô tả..."
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
