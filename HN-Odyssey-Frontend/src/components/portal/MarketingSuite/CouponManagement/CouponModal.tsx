import { useState, useRef, useEffect, type FormEvent } from "react";
import "./CouponModal.css";
import axiosClient from "../../../../api/axiosClient";
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

interface OptionData {
  id: string;
  name: string;
}

interface ProductItem {
  _id: string;
  name: string;
}

interface ProductResponse {
  data: ProductItem[];
}

interface CategoryItem {
  _id: string;
  name: string;
  children?: CategoryItem[];
}

interface TagItem {
  _id: string;
  name: string;
}

const defaultFormData: CouponFormData = {
  code: "",
  discountType: "PERCENTAGE",
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
  { label: "Percentage - %", value: "PERCENTAGE" },
  { label: "Fixed Amount - $", value: "FIXED_AMOUNT" },
];

const flattenCategories = (
  nodes: CategoryItem[],
  parentPath = "",
): OptionData[] => {
  let result: OptionData[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({ id: node._id, name: currentPath });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCategories(node.children, currentPath));
    }
  }
  return result;
};

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

function MultiSelectDropdown({
  options,
  selectedValues, // Chứa mảng ID
  onChange,
  placeholder,
  disabled,
  onSearchChange,
  isLoading,
}: {
  options: OptionData[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  onSearchChange?: (val: string) => void;
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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  // Lọc option dựa trên ID thay vì Name
  const filteredOptions = onSearchChange
    ? options.filter((opt) => !selectedValues.includes(opt.id))
    : options.filter(
        (opt) =>
          opt.name.toLowerCase().includes(search.toLowerCase()) &&
          !selectedValues.includes(opt.id),
      );

  const handleSelect = (id: string) => {
    onChange([...selectedValues, id]);
    setSearch("");
    if (onSearchChange) onSearchChange("");
    setIsOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(selectedValues.filter((v) => v !== id));
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
            onChange={handleSearch}
            onFocus={() => setIsOpen(true)}
          />
          {isOpen && (
            <div className="coupon-select-dropdown">
              {isLoading ? (
                <div className="coupon-select-empty">Loading...</div>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="coupon-select-option"
                    onClick={() => handleSelect(opt.id)} // Chọn ID
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
        {selectedValues.map((idVal) => {
          // Map ID ngược lại thành Name để hiển thị cho User
          const matchedOpt = options.find((o) => o.id === idVal);
          const displayName = matchedOpt ? matchedOpt.name : idVal;

          return (
            <div key={idVal} className="coupon-chip-item">
              {displayName}
              {!disabled && (
                <button
                  type="button"
                  className="coupon-chip-remove-btn"
                  onClick={() => handleRemove(idVal)} // Gỡ ID
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
  const [productsData, setProductsData] = useState<OptionData[]>([]);
  const [categoriesData, setCategoriesData] = useState<OptionData[]>([]);
  const [tagsData, setTagsData] = useState<OptionData[]>([]);

  // State xử lý call API động cho Products
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Fetch dữ liệu tĩnh (Category, Tag) lúc mới mở Modal
  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [catRes, tagRes] = await Promise.all([
          axiosClient.get<CategoryItem[]>("/categories/tree-view"),
          axiosClient.get<TagItem[]>("/tags"),
        ]);

        if (catRes.data) {
          // SỬA ĐỔI: Gọi hàm flatten
          setCategoriesData(flattenCategories(catRes.data));
        }
        if (tagRes.data) {
          setTagsData(tagRes.data.map((t) => ({ id: t._id, name: t.name })));
        }
      } catch (error) {
        console.error("Failed to fetch categories and tags", error);
      }
    };
    fetchStaticData();
  }, []);

  // Fetch dữ liệu động cho Products (Có áp dụng Debounce)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsSearchingProducts(true);
        // Mặc định gọi 20 item, có keyword sẽ truyền param search
        const params: { limit: number; search?: string } = { limit: 20 };
        if (productSearchTerm) {
          params.search = productSearchTerm;
        }

        const prodRes = await axiosClient.get<ProductResponse>(
          "/products/store/list",
          {
            params,
          },
        );

        if (prodRes.data?.data) {
          setProductsData(
            prodRes.data.data.map((p) => ({ id: p._id, name: p.name })),
          );
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setIsSearchingProducts(false);
      }
    };

    // Delay request 500ms sau khi người dùng ngừng gõ
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [productSearchTerm]);

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
        isDraft: initialData.status === "DRAFT",
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

  const handleChange = (
    field: keyof CouponFormData,
    value: string | boolean | ApplicableScopeObj,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
      <div
        className={`coupon-modal-overlay ${isClosing ? "closing" : ""}`}
        onClick={onClose}
      ></div>
      <div className={`coupon-modal-container ${isClosing ? "closing" : ""}`}>
        <form onSubmit={handleSubmit} className="coupon-modal-form">
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
                    formData.discountType === "PERCENTAGE"
                      ? "e.g. 20"
                      : "e.g. 10"
                  }
                  value={formData.discountValueNum}
                  onChange={(e) =>
                    handleChange("discountValueNum", e.target.value)
                  }
                  disabled={isViewMode}
                  min="0"
                  step={formData.discountType === "PERCENTAGE" ? "1" : "0.01"}
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

            {formData.discountType === "PERCENTAGE" && (
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
                    options={categoriesData}
                    selectedValues={formData.applicableScope.categories}
                    onChange={(vals) => handleScopeChange("categories", vals)}
                    placeholder="Select Category..."
                    disabled={isViewMode}
                  />
                )}

                {activeToggles.products && (
                  <MultiSelectDropdown
                    options={productsData}
                    selectedValues={formData.applicableScope.products}
                    onChange={(vals) => handleScopeChange("products", vals)}
                    placeholder="Type to search Products..."
                    disabled={isViewMode}
                    onSearchChange={setProductSearchTerm} // Gắn hàm Search API động
                    isLoading={isSearchingProducts} // Gắn loading state
                  />
                )}

                {activeToggles.tags && (
                  <MultiSelectDropdown
                    options={tagsData}
                    selectedValues={formData.applicableScope.tags}
                    onChange={(vals) => handleScopeChange("tags", vals)}
                    placeholder="Select Tag..."
                    disabled={isViewMode}
                  />
                )}
              </div>
            </div>

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
