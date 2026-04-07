import { useState, useRef, type FormEvent } from "react";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import "./BlogNewsDrawer.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  ArrowLeftIcon,
  UploadIcon,
  CloseIcon,
  ChevronDownIcon,
} from "../../../../assets/icons/BlogNewsManagementIcons";
import {
  generateSlug,
  ACTIVE_CATEGORIES,
} from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";
import type {
  BlogNewsFormData,
  BlogNewsRecord,
} from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";

interface BlogNewsDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: BlogNewsRecord | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: BlogNewsFormData) => void;
}

// mock data
const MOCK_PRODUCTS = [
  { id: "p1", name: "Áo Polo Malbon Golf", price: "1.200.000đ" },
  { id: "p2", name: "Nước hoa CK One 100ml", price: "950.000đ" },
  { id: "p3", name: "Bàn phím cơ MonsGeek M1", price: "2.500.000đ" },
  { id: "p4", name: "Vợt cầu lông Yonex Astrox", price: "3.100.000đ" },
];

export default function BlogNewsDrawer(props: BlogNewsDrawerProps) {
  if (!props.isOpen) return null;
  const drawerKey =
    props.mode === "add" ? "add-new" : props.initialData?.id || "drawer";
  return <DrawerContent key={drawerKey} {...props} />;
}

function DrawerContent({
  mode,
  initialData,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<BlogNewsDrawerProps, "isOpen">) {
  const [formData, setFormData] = useState<BlogNewsFormData>(() => {
    if (initialData && (mode === "edit" || mode === "view")) {
      return {
        ...initialData,
        attachedProducts: initialData.attachedProducts || [],
      };
    }
    return {
      title: "",
      slug: "",
      category: "",
      status: "Draft",
      featuredImage: "",
      content: "",
      metaTitle: "",
      metaDescription: "",
      attachedProducts: [],
    };
  });

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const isViewMode = mode === "view";

  // Kiểm tra form hợp lệ: Các trường bắt buộc không được để trống
  const isContentEmpty =
    !formData.content ||
    formData.content.trim() === "" ||
    formData.content === "<p><br></p>";

  const isFormValid =
    formData.title.trim() !== "" &&
    formData.category.trim() !== "" &&
    formData.featuredImage.trim() !== "" &&
    formData.slug.trim() !== "" &&
    !isContentEmpty;

  const isSubmitDisabled = isSubmitting || !isFormValid;

  // xử lý đóng dropdown danh mục khi click ra ngoài
  useClickOutside(categoryRef, () => setIsCategoryOpen(false));

  // hàm xử lý thay đổi dữ liệu chung
  const handleChange = (
    field: keyof BlogNewsFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // tự động tạo slug và meta title khi người dùng nhập title ở chế độ add
      if (field === "title" && mode === "add" && typeof value === "string") {
        newData.slug = generateSlug(value);
        if (!newData.metaTitle) newData.metaTitle = value;
      }
      return newData;
    });
  };

  // đọc file ảnh từ máy tính chuyển sang base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      handleChange("featuredImage", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // chọn/bỏ chọn sản phẩm đính kèm
  const handleToggleProduct = (productId: string) => {
    setFormData((prev) => {
      const currentProducts = prev.attachedProducts;
      const isSelected = currentProducts.includes(productId);

      const newProducts = isSelected
        ? currentProducts.filter((id) => id !== productId)
        : [...currentProducts, productId];

      return { ...prev, attachedProducts: newProducts };
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }
    // Chặn submit nếu form chưa hợp lệ (phòng trường hợp click bằng phím Enter)
    if (!isFormValid) return;

    onSubmit(formData);
  };

  const getProductName = (id: string) => {
    return MOCK_PRODUCTS.find((p) => p.id === id)?.name || id;
  };

  return (
    <div
      className="ban-drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="ban-drawer-container">
        <div className="ban-drawer-header">
          <button
            type="button"
            className="ban-drawer-back-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <ArrowLeftIcon />
          </button>
          <h2 className="ban-drawer-title">
            {mode === "add"
              ? "Create Article"
              : mode === "edit"
                ? "Edit Article"
                : "Article Details"}
          </h2>
        </div>

        <form className="ban-drawer-body" id="ban-form" onSubmit={handleSubmit}>
          <div className="ban-form-group">
            <label>
              Title <span className="ban-required">*</span>
            </label>
            <input
              type="text"
              className="ban-form-input"
              placeholder="Enter article title"
              required
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              disabled={isViewMode || isSubmitting}
            />
          </div>

          {/* khu vực chọn danh mục (đã chuyển thành Dropdown) */}
          <div className="ban-form-group">
            <label>
              Category <span className="ban-required">*</span>
            </label>
            <div className="ban-drawer-custom-dropdown" ref={categoryRef}>
              <div
                className={`ban-drawer-dropdown-trigger ${isCategoryOpen ? "active" : ""} ${isViewMode || isSubmitting ? "disabled" : ""}`}
                onClick={() => {
                  if (!isViewMode && !isSubmitting) {
                    setIsCategoryOpen(!isCategoryOpen);
                  }
                }}
              >
                <span
                  style={{ color: formData.category ? "#111827" : "#9ca3af" }}
                >
                  {formData.category || "Select a category"}
                </span>
                <ChevronDownIcon className={isCategoryOpen ? "open" : ""} />
              </div>
              {isCategoryOpen && (
                <div className="ban-drawer-dropdown-options">
                  {ACTIVE_CATEGORIES.map((cat) => (
                    <div
                      key={cat}
                      className={`ban-drawer-dropdown-option ${formData.category === cat ? "active" : ""}`}
                      onClick={() => {
                        handleChange("category", cat);
                        setIsCategoryOpen(false);
                      }}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ban-form-group">
            <label>
              Featured Image <span className="ban-required">*</span>
            </label>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            {formData.featuredImage ? (
              <div className="ban-upload-preview">
                <img src={formData.featuredImage} alt="Featured" />
                {!isViewMode && (
                  <button
                    type="button"
                    className="ban-btn-remove-img"
                    onClick={() => {
                      handleChange("featuredImage", "");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ) : (
              <div
                className="ban-upload-box"
                onClick={() => {
                  if (!isViewMode && !isSubmitting) {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <UploadIcon color="#9ca3af" />
                <p>Click to browse image from computer</p>
              </div>
            )}
          </div>

          <div className="ban-form-group">
            <label>
              Content <span className="ban-required">*</span>
            </label>
            <div
              className={`ban-suneditor-wrapper ${isViewMode ? "disabled" : ""}`}
            >
              <SunEditor
                setContents={formData.content}
                onChange={(content) => handleChange("content", content)}
                disable={isViewMode || isSubmitting}
                setOptions={{
                  height: "550px",
                  resizingBar: false,
                  buttonList: [
                    ["undo", "redo"],
                    ["font", "fontSize", "formatBlock"],
                    [
                      "bold",
                      "underline",
                      "italic",
                      "strike",
                      "subscript",
                      "superscript",
                    ],
                    ["removeFormat"],
                    "/",
                    [
                      "fontColor",
                      "hiliteColor",
                      "outdent",
                      "indent",
                      "align",
                      "horizontalRule",
                      "list",
                      "table",
                    ],
                    [
                      "link",
                      "image",
                      "video",
                      "fullScreen",
                      "showBlocks",
                      "codeView",
                    ],
                  ],
                }}
              />
            </div>

            {formData.attachedProducts.length > 0 && (
              <div className="ban-attached-products-list">
                {formData.attachedProducts.map((id) => (
                  <span key={id} className="ban-product-tag">
                    🛍️ {getProductName(id)}
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => handleToggleProduct(id)}
                      >
                        <CloseIcon />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {!isViewMode && (
              <button
                type="button"
                className="ban-btn-attach-product"
                disabled={isSubmitting}
                onClick={() => setIsProductModalOpen(true)}
              >
                + Select Attached Products
              </button>
            )}
          </div>

          <div className="ban-form-group">
            <label>
              Slug (URL) <span className="ban-required">*</span>
            </label>
            <input
              type="text"
              className="ban-form-input"
              placeholder="e.g. fashion-trends-2024"
              required
              value={formData.slug}
              onChange={(e) => handleChange("slug", e.target.value)}
              disabled={isViewMode || isSubmitting}
            />
          </div>

          <div className="ban-form-group">
            <label>Meta Title</label>
            <input
              type="text"
              className="ban-form-input"
              placeholder="SEO Title (Max 60 characters)"
              value={formData.metaTitle}
              onChange={(e) => handleChange("metaTitle", e.target.value)}
              disabled={isViewMode || isSubmitting}
            />
          </div>

          <div className="ban-form-group">
            <label>Meta Description (Used as Short Description)</label>
            <textarea
              className="ban-form-textarea"
              style={{ minHeight: "60px" }}
              placeholder="SEO Description & Short Summary (Max 160 characters)"
              value={formData.metaDescription}
              onChange={(e) => handleChange("metaDescription", e.target.value)}
              disabled={isViewMode || isSubmitting}
            />
          </div>

          <div className="ban-form-group">
            <label>Search Engine Preview</label>
            <div className="ban-seo-preview">
              <div className="ban-seo-url">
                hn-odyssey.com › blog › {formData.slug || "your-article-slug"}
              </div>
              <div className="ban-seo-title">
                {formData.metaTitle ||
                  formData.title ||
                  "Your Article Title Will Appear Here"}
              </div>
              <div className="ban-seo-desc">
                {formData.metaDescription ||
                  "Provide a meta description to see how your article will be presented in search results."}
              </div>
            </div>
          </div>

          <div className="ban-form-group">
            <label>Status</label>
            <div className="ban-toggle-wrapper">
              <div
                className={`ban-toggle-switch ${formData.status === "Published" ? "on" : ""}`}
                onClick={() => {
                  if (!isViewMode && !isSubmitting) {
                    handleChange(
                      "status",
                      formData.status === "Published" ? "Draft" : "Published",
                    );
                  }
                }}
              />
              <span style={{ fontWeight: 600 }}>
                {formData.status === "Published" ? "Published" : "Draft"}
              </span>
            </div>
          </div>
        </form>

        <div className="ban-drawer-footer">
          {!isViewMode && (
            <button
              type="submit"
              form="ban-form"
              className="ban-btn-submit"
              disabled={
                isSubmitDisabled
              } /* Trạng thái nút bị mờ nếu chưa đủ field */
            >
              {isSubmitting
                ? "Saving..."
                : mode === "add"
                  ? "Create Article"
                  : "Save Changes"}
            </button>
          )}
          <button
            type="button"
            className="ban-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {isViewMode ? "Close" : "Cancel"}
          </button>
        </div>

        {/* modal nội bộ chọn sản phẩm đính kèm */}
        {isProductModalOpen && (
          <div
            className="ban-product-modal-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsProductModalOpen(false);
              }
            }}
          >
            <div className="ban-product-modal">
              <div className="ban-product-modal-header">
                Select Products
                <button
                  type="button"
                  className="ban-product-modal-close"
                  onClick={() => setIsProductModalOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="ban-product-list">
                {MOCK_PRODUCTS.map((product) => (
                  <label key={product.id} className="ban-product-item">
                    <input
                      type="checkbox"
                      checked={formData.attachedProducts.includes(product.id)}
                      onChange={() => handleToggleProduct(product.id)}
                    />
                    <div className="ban-product-info">
                      <span className="ban-product-name">{product.name}</span>
                      <span className="ban-product-price">{product.price}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="ban-product-modal-btn"
                onClick={() => setIsProductModalOpen(false)}
              >
                Confirm Selection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
