import { useState, useEffect, useRef } from "react";
import "./ProductForm.css";
import TagModal from "../ProductManagementModal/TagModal";
import VariantModal from "../ProductManagementModal/VariantModal";
import SetPriceModal from "../ProductManagementModal/SetPriceModal";
import { ChevronDownIcon } from "../../../../../assets/icons/HeaderIcons";
import { EditPenIcon } from "../../../../../assets/icons/ProductManagementIcons";

// import
import {
  type ProductData,
  type PricingItem,
  type CategoryNode,
  type VariantAttribute,
  AVAILABLE_TAGS,
  MOCK_AVAILABLE_ATTRIBUTES,
  MOCK_CATEGORIES,
} from "../../../../../hooks/portal/ProductCatalog/ProductManagement/useProductForm";

// interface props
interface ProductFormProps {
  mode: "add" | "edit" | "view";
  formData: ProductData;
  pricingList: PricingItem[];
  tags: string[];
  productVariants: VariantAttribute[];
  categoryError: string;
  userRole?: "admin" | "employee";
  actions: {
    changeInput: (name: keyof ProductData, value: string) => void;
    changeCategory: (categoryId: string) => void;
    updateTags: (newTags: string[]) => void;
    removeTag: (tagToRemove: string) => void;
    confirmVariant: (
      updatedAttributes: VariantAttribute[],
      editingVariantId?: string,
    ) => void;
    savePrice: (priceId: string, newPrice: number) => void;
    submitSinglePrice: (id: string) => void;
    approveSinglePrice: (id: string) => void;
    rejectSinglePrice: (id: string) => void;
    viewApproval: () => void;
    saveProduct: () => boolean;
    cancel: () => void;
  };
}

// hàm tìm đường dẫn danh mục
const findCategoryPath = (
  nodes: CategoryNode[],
  targetId: string,
  currentPath: string[] = [],
): string[] | null => {
  for (const node of nodes) {
    const path = [...currentPath, node.name];
    if (node.id === targetId) return path;
    if (node.children) {
      const result = findCategoryPath(node.children, targetId, path);
      if (result) return result;
    }
  }
  return null;
};

// component dropdown
function CustomFormDropdown({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || value;

  return (
    <div
      className={`pf-custom-dropdown ${disabled ? "view-mode" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`pf-dropdown-trigger ${isOpen ? "active" : ""} ${disabled ? "view-mode" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        {!disabled && (
          <span
            style={{ color: "#6b7280", display: "flex", alignItems: "center" }}
          >
            <ChevronDownIcon
              className={`pf-dropdown-arrow ${isOpen ? "open" : ""}`}
            />
          </span>
        )}
      </div>
      {isOpen && !disabled && (
        <div className="pf-dropdown-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`pf-dropdown-item ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductForm({
  mode,
  formData,
  pricingList,
  tags,
  productVariants,
  categoryError,
  userRole = "admin",
  actions,
}: ProductFormProps) {
  // state quản lý cây danh mục
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    c1: true,
  });
  const treeRef = useRef<HTMLDivElement>(null);

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantAttribute | null>(
    null,
  );

  const [isSetPriceModalOpen, setIsSetPriceModalOpen] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState<PricingItem | null>(
    null,
  );

  const isViewMode = mode === "view";

  // xử lý click ra ngoài để đóng cây danh mục
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (treeRef.current && !treeRef.current.contains(e.target as Node))
        setIsTreeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasPendingApproval = pricingList.some((p) => p.status === "pending");
  const categoryPath = formData.categoryId
    ? findCategoryPath(MOCK_CATEGORIES, formData.categoryId)?.join(" > ")
    : "";

  // đệ quy render cây danh mục
  const renderTreeNodes = (nodes: CategoryNode[], level: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes[node.id];
      const hasChildren = node.children && node.children.length > 0;
      const isSelected = formData.categoryId === node.id;

      const handleSingleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren)
          setExpandedNodes((prev) => ({ ...prev, [node.id]: !isExpanded }));
        else {
          actions.changeCategory(node.id);
          setIsTreeOpen(false);
        }
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
          actions.changeCategory(node.id);
          setIsTreeOpen(false);
        }
      };

      return (
        <div key={node.id}>
          <div
            className={`pf-tree-node ${isSelected ? "selected" : ""}`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
          >
            {hasChildren ? (
              <div className="pf-tree-toggle">
                <ChevronDownIcon
                  className={`pf-tree-toggle-icon ${isExpanded ? "expanded" : "collapsed"}`}
                />
              </div>
            ) : (
              <div className="pf-tree-spacer"></div>
            )}
            <span className="pf-tree-node-name">{node.name}</span>
          </div>
          {hasChildren &&
            isExpanded &&
            renderTreeNodes(node.children!, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="pf-container">
      <div className="pf-header">
        <div>
          <h1 className="pf-title">
            {isViewMode
              ? "Product Detail"
              : mode === "edit"
                ? "Edit Product"
                : "Add New Product"}
          </h1>
          <p className="pf-breadcrumb">
            Product Catalog / Product Management /{" "}
            {isViewMode ? "Detail" : mode === "edit" ? "Edit" : "New"}
          </p>
        </div>
      </div>

      <section className="pf-section">
        <h3 className="pf-section-title">Product Information</h3>
        <div className="pf-grid-info">
          <div className="pf-input-group">
            <label>SKU</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={(e) => actions.changeInput("sku", e.target.value)}
              disabled={isViewMode}
            />
          </div>
          <div className="pf-input-group">
            <label>Product Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => actions.changeInput("name", e.target.value)}
              disabled={isViewMode}
            />
          </div>
          <div className="pf-input-group">
            <label>Status</label>
            <CustomFormDropdown
              value={formData.status}
              options={[
                { label: "Draft", value: "Draft" },
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
              onChange={(val) => actions.changeInput("status", val)}
              disabled={isViewMode}
            />
          </div>
          <div className="pf-input-group pf-col-span-full">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) =>
                actions.changeInput("description", e.target.value)
              }
              rows={3}
              disabled={isViewMode}
            />
          </div>
        </div>
      </section>

      <section className="pf-section">
        <h3 className="pf-section-title">Category Selection</h3>
        <div className="pf-input-group">
          <label>
            Category Hierarchy <span style={{ color: "red" }}>*</span>
          </label>
          <div className="pf-tree-select" ref={treeRef}>
            <div
              className={`pf-tree-trigger ${isViewMode ? "view-mode" : ""} ${categoryError ? "error" : ""}`}
              onClick={() => !isViewMode && setIsTreeOpen(!isTreeOpen)}
            >
              {categoryPath ? (
                <span>{categoryPath}</span>
              ) : (
                <span className="pf-tree-placeholder">
                  Select a category...
                </span>
              )}
              {!isViewMode && (
                <span
                  style={{
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ChevronDownIcon
                    className={`pf-tree-toggle-icon ${isTreeOpen ? "expanded" : "collapsed"}`}
                  />
                </span>
              )}
            </div>
            {categoryError && (
              <span className="pf-error-text">{categoryError}</span>
            )}
            {isTreeOpen && !isViewMode && (
              <div className="pf-tree-dropdown">
                {renderTreeNodes(MOCK_CATEGORIES)}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="pf-grid-2-cols">
        {/* Pricing Table */}
        <section className="pf-section">
          <div className="pf-section-header-row">
            <h3 className="pf-section-title">Pricing & Approval</h3>
            {/* Hiển thị badge vàng bên cạnh title nếu có dòng đang chờ duyệt */}
            {hasPendingApproval && (
              <span className="pf-badge pending">pending Approval</span>
            )}
          </div>
          <div className="pf-table-wrapper">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Price</th>
                  <th>Status</th>
                  {!isViewMode && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {pricingList.map((item) => (
                  <tr key={item.id}>
                    <td>{item.variantName}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>
                      {item.status === "draft" && (
                        <span className="pf-badge draft">Draft</span>
                      )}
                      {item.status === "pending" && (
                        <span className="pf-badge pending">pending</span>
                      )}
                      {item.status === "approved" && (
                        <span className="pf-badge success">Approved</span>
                      )}
                      {item.status === "rejected" && (
                        <span className="pf-badge rejected">Rejected</span>
                      )}
                    </td>
                    {!isViewMode && (
                      <td>
                        <div className="pf-action-group">
                          {(item.status === "draft" ||
                            item.status === "rejected") && (
                            <>
                              <button
                                type="button"
                                className="pf-btn-action white"
                                onClick={(e) => {
                                  setEditingPriceItem(item);
                                  setIsSetPriceModalOpen(true);
                                  e.currentTarget.blur();
                                }}
                              >
                                <EditPenIcon />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="pf-btn-action blue"
                                disabled={item.status === "rejected"}
                                onClick={(e) => {
                                  actions.submitSinglePrice(item.id);
                                  e.currentTarget.blur();
                                }}
                              >
                                Submit
                              </button>
                            </>
                          )}
                          {item.status === "pending" &&
                            userRole === "admin" && (
                              <>
                                <button
                                  type="button"
                                  className="pf-btn-action blue"
                                  onClick={(e) => {
                                    actions.approveSinglePrice(item.id);
                                    e.currentTarget.blur();
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="pf-btn-action red"
                                  onClick={(e) => {
                                    actions.rejectSinglePrice(item.id);
                                    e.currentTarget.blur();
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          {item.status === "pending" &&
                            userRole === "employee" && (
                              <button
                                type="button"
                                className="pf-btn-action blue"
                                onClick={(e) => {
                                  actions.viewApproval();
                                  e.currentTarget.blur();
                                }}
                              >
                                View Approval
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isViewMode && (
            <div className="pf-section-footer" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="pf-btn-full light-blue"
                onClick={(e) => {
                  actions.viewApproval();
                  e.currentTarget.blur();
                }}
              >
                Price Management
              </button>
            </div>
          )}
        </section>

        {/* Product Variants Table */}
        <section className="pf-section">
          <h3 className="pf-section-title">Product Variants</h3>
          <div className="pf-table-wrapper">
            <table className="pf-table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Variant Attribute</th>
                  <th style={{ width: "50%" }}>Value</th>
                  {!isViewMode && (
                    <th style={{ width: "20%", textAlign: "center" }}>
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {productVariants.map((attr) => (
                  <tr key={attr.id}>
                    <td style={{ verticalAlign: "middle" }}>{attr.name}</td>
                    <td style={{ verticalAlign: "middle" }}>
                      {attr.values.length > 0 ? (
                        <div className="pf-variant-value-box">
                          {attr.values.join(", ")}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                          No Attribute.
                        </span>
                      )}
                    </td>
                    {!isViewMode && (
                      <td
                        style={{ verticalAlign: "middle", textAlign: "center" }}
                      >
                        <button
                          type="button"
                          className="pf-edit-icon-btn"
                          onClick={(e) => {
                            setEditingVariant(attr);
                            setIsVariantModalOpen(true);
                            e.currentTarget.blur();
                          }}
                        >
                          <EditPenIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isViewMode && (
            <button
              type="button"
              className="pf-add-variant-btn"
              onClick={(e) => {
                setEditingVariant(null);
                setIsVariantModalOpen(true);
                e.currentTarget.blur();
              }}
            >
              Manage Variant Options
            </button>
          )}
        </section>
      </div>

      <section className="pf-section">
        <h3 className="pf-section-title">Product Tags</h3>
        <div
          className={`pf-tags-container ${isViewMode ? "view-mode" : ""}`}
          role="button"
          tabIndex={isViewMode ? -1 : 0}
          onClick={() => !isViewMode && setIsTagModalOpen(true)}
        >
          <div className="pf-tags-list">
            {tags.map((tag) => (
              <span
                key={tag}
                className="pf-tag-chip"
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
                {!isViewMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      actions.removeTag(tag);
                      e.currentTarget.blur();
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {tags.length === 0 && (
            <span className="pf-tags-placeholder">
              No tag selected. Click to add tags.
            </span>
          )}
        </div>
      </section>

      <div className="pf-footer-actions">
        {isViewMode ? (
          <button
            type="button"
            className="pf-btn-outline"
            onClick={(e) => {
              actions.cancel();
              e.currentTarget.blur();
            }}
          >
            Back to List
          </button>
        ) : (
          <>
            <button
              type="button"
              className="pf-btn-outline"
              onClick={(e) => {
                actions.cancel();
                e.currentTarget.blur();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pf-btn-primary"
              onClick={(e) => {
                actions.saveProduct();
                e.currentTarget.blur();
              }}
            >
              Save Product
            </button>
          </>
        )}
      </div>

      {!isViewMode && (
        <>
          <TagModal
            isOpen={isTagModalOpen}
            onClose={() => setIsTagModalOpen(false)}
            availableTags={AVAILABLE_TAGS}
            selectedTags={tags}
            onConfirm={(newTags) => actions.updateTags(newTags)}
          />

          <VariantModal
            isOpen={isVariantModalOpen}
            onClose={() => setIsVariantModalOpen(false)}
            initialAttribute={editingVariant}
            availableAttributes={MOCK_AVAILABLE_ATTRIBUTES}
            existingVariants={productVariants}
            onConfirm={(updatedAttributes) => {
              actions.confirmVariant(updatedAttributes, editingVariant?.id);
              setIsVariantModalOpen(false);
            }}
          />

          <SetPriceModal
            isOpen={isSetPriceModalOpen}
            onClose={() => setIsSetPriceModalOpen(false)}
            productName={formData.name || "N/A"}
            sku={formData.sku || "N/A"}
            initialPrice={editingPriceItem?.price || 0}
            onSave={(newPrice) => {
              if (editingPriceItem) {
                actions.savePrice(editingPriceItem.id, newPrice);
              }
              setIsSetPriceModalOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
