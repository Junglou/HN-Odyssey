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
  type BlogNewsFormData,
  type BlogNewsRecord,
  type BECategoryResponse,
  type BEProductResponse,
} from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";
import axiosClient from "../../../../api/axiosClient";

interface BlogNewsDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit" | "view";
  initialData: BlogNewsRecord | null;
  isSubmitting: boolean;
  categories: BECategoryResponse[];
  products: BEProductResponse[];
  onClose: () => void;
  onSubmit: (data: BlogNewsFormData) => void;
}

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
  categories,
  products,
  onClose,
  onSubmit,
}: Omit<BlogNewsDrawerProps, "isOpen">) {
  const [formData, setFormData] = useState<BlogNewsFormData>(() => {
    if (initialData && (mode === "edit" || mode === "view")) {
      return {
        ...initialData,
        categoryId: initialData.categoryId || "",
        attachedProducts: initialData.attachedProducts || [],
      };
    }
    return {
      title: "",
      slug: "",
      categoryId: "",
      status: "Draft",
      featuredImage: "",
      content: "",
      metaTitle: "",
      metaDescription: "",
      attachedProducts: [],
    };
  });

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [hasCategoryOpened, setHasCategoryOpened] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const isViewMode = mode === "view";

  const isContentEmpty =
    !formData.content ||
    formData.content.trim() === "" ||
    formData.content === "<p><br></p>";

  const isFormValid =
    formData.title.trim() !== "" &&
    formData.categoryId.trim() !== "" &&
    formData.featuredImage.trim() !== "" &&
    formData.slug.trim() !== "" &&
    !isContentEmpty;

  const isSubmitDisabled = isSubmitting || !isFormValid;

  useClickOutside(categoryRef, () => setIsCategoryOpen(false));

  const handleChange = (
    field: keyof BlogNewsFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "title" && mode === "add" && typeof value === "string") {
        newData.slug = generateSlug(value);
        if (!newData.metaTitle) newData.metaTitle = value;
      }
      if (field === "categoryId" && prev.categoryId !== value) {
        newData.attachedProducts = [];
      }
      return newData;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        handleChange("featuredImage", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

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
    if (!isFormValid) return;
    onSubmit(formData);
  };

  const getProductName = (id: string) => {
    return products.find((p) => p._id === id)?.name || id;
  };

  // Hàm can thiệp quá trình tải ảnh của editor để gọi thẳng lên API upload thay vì dùng base64
  const handleImageUploadBefore = (
    files: File[],
    _info: object,
    uploadHandler: (
      response?:
        | { result: { url: string; name: string; size: number }[] }
        | string,
    ) => void,
  ) => {
    const file = files[0];
    if (!file) return true;

    const uploadData = new FormData();
    uploadData.append("file", file);

    axiosClient
      .post("/upload/single", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        if (res.data && res.data.path) {
          uploadHandler({
            result: [
              {
                url: res.data.path,
                name: res.data.filename,
                size: file.size,
              },
            ],
          });
        } else {
          uploadHandler();
        }
      })
      .catch((err: Error) => {
        console.error("Lỗi khi tải ảnh của bài viết lên máy chủ:", err);
        uploadHandler(err.message);
      });

    // Trả về false để huỷ hành vi mặc định của SunEditor
    return false;
  };

  const flattenedCategories = categories.map((c) => ({
    id: c._id,
    name: c.name,
  }));

  const currentCategoryName = flattenedCategories.find(
    (c) => c.id === formData.categoryId,
  )?.name;

  const filteredDrawerCategories = flattenedCategories.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()),
  );

  const filteredProducts = products.filter((p) => {
    if (!formData.categoryId || !p.categories || !Array.isArray(p.categories)) {
      return false;
    }
    return p.categories.some((cat) => {
      const pCatId = typeof cat === "object" && cat !== null ? cat._id : cat;
      return pCatId === formData.categoryId;
    });
  });

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
                    if (!hasCategoryOpened) setHasCategoryOpened(true);
                    if (isCategoryOpen) setCategorySearchTerm("");
                  }
                }}
              >
                <span
                  className={`ban-drawer-dropdown-value ${formData.categoryId ? "selected" : "placeholder"}`}
                >
                  {currentCategoryName || "Select a category"}
                </span>
                <ChevronDownIcon className={isCategoryOpen ? "open" : ""} />
              </div>

              {isCategoryOpen && (
                <div
                  className="ban-drawer-dropdown-options open"
                  style={{
                    maxHeight: "250px",
                    overflowY: "auto",
                    display: "block",
                    padding: 0,
                  }}
                >
                  <div
                    className="promo-select-input-wrapper"
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#fff",
                      zIndex: 10,
                      padding: "8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="promo-form-input promo-select-search"
                      placeholder="Search category..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      style={{ width: "100%", marginBottom: 0 }}
                    />
                  </div>

                  <div style={{ padding: "4px" }}>
                    {filteredDrawerCategories.length > 0 ? (
                      filteredDrawerCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className={`ban-drawer-dropdown-option ${formData.categoryId === cat.id ? "active" : ""}`}
                          onClick={() => {
                            handleChange("categoryId", cat.id);
                            setIsCategoryOpen(false);
                            setCategorySearchTerm("");
                          }}
                        >
                          {cat.name}
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "#6b7280",
                        }}
                      >
                        No results found
                      </div>
                    )}
                  </div>
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
              className="ban-hidden-file-input"
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
                defaultValue={formData.content} // đổi từ setContents thành defaultValue để tránh re-render liên tục
                onChange={(content) => handleChange("content", content)}
                onImageUploadBefore={handleImageUploadBefore}
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
              disabled={isSubmitting || !formData.categoryId}
              onClick={() => setIsProductModalOpen(true)}
            >
              + Select Attached Products{" "}
              {!formData.categoryId && "(Please select a category first)"}
            </button>
          )}

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
              className="ban-form-textarea ban-meta-textarea"
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
              <span className="ban-toggle-label">
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
              disabled={isSubmitDisabled}
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
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <label key={product._id} className="ban-product-item">
                      <input
                        type="checkbox"
                        checked={formData.attachedProducts.includes(
                          product._id,
                        )}
                        onChange={() => handleToggleProduct(product._id)}
                      />
                      <div className="ban-product-info">
                        <span className="ban-product-name">{product.name}</span>
                        <span className="ban-product-price">
                          {product.price}
                        </span>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="ban-product-empty-state">
                    No products found in this category.
                  </div>
                )}
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
