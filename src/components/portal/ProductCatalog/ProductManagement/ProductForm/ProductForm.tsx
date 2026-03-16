import { useState, useEffect, useRef } from "react";
import "./ProductForm.css";
import TagModal from "../ProductManagementModal/TagModal";
import VariantModal, {
  type VariantAttribute,
} from "../ProductManagementModal/VariantModal";
import SetPriceModal from "../ProductManagementModal/SetPriceModal";
import { ChevronDownIcon } from "../../../../../assets/icons/HeaderIcons";
import { EditPenIcon } from "../../../../../assets/icons/ProductManagementIcons";

export interface ProductData {
  sku: string;
  name: string;
  status: "Active" | "Inactive" | "Draft";
  description: string;
  categoryId: string;
}

export interface PricingItem {
  id: string;
  variantName: string;
  price: number;
  status: "draft" | "pending" | "approved" | "rejected";
}

export interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

interface ProductFormProps {
  mode: "add" | "edit" | "view";
  initialData: ProductData;
  pricingList: PricingItem[];
  initialTags: string[];
  // giả lập admin
  userRole?: "admin" | "employee";
  onCancel: () => void;
  onSave: (data: ProductData, tags: string[], pricing: PricingItem[]) => void;
  onApprovePrices: () => void;
}

const AVAILABLE_TAGS = ["New Arrival", "Winter", "Summer", "Sale"];

const MOCK_AVAILABLE_ATTRIBUTES: VariantAttribute[] = [
  { id: "1", name: "Size", values: ["S", "M", "L", "XL", "XXL", "XXXL"] },
  {
    id: "2",
    name: "Color",
    values: ["Navy", "Grey", "Olive", "Black", "White"],
  },
  {
    id: "3",
    name: "Material",
    values: ["Cotton", "Polyester", "Silk", "Denim"],
  },
];

const MOCK_CATEGORIES: CategoryNode[] = [
  {
    id: "c1",
    name: "Women",
    children: [
      {
        id: "c1-1",
        name: "Outerwear",
        children: [{ id: "c1-1-1", name: "Jackets" }],
      },
    ],
  },
];

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

export default function ProductForm({
  mode,
  initialData,
  pricingList,
  initialTags,
  userRole = "admin", // Giả lập mặc định là admin để test full luồng
  onCancel,
  onSave,
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductData>(initialData);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [localPricing, setLocalPricing] = useState<PricingItem[]>(pricingList);
  const [productVariants, setProductVariants] = useState<VariantAttribute[]>(
    [],
  );

  const [categoryError, setCategoryError] = useState<string>("");
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

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);
  useEffect(() => {
    setLocalPricing(pricingList);
  }, [pricingList]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (treeRef.current && !treeRef.current.contains(e.target as Node))
        setIsTreeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }) as ProductData);
  };

  const removeTag = (tagToRemove: string) => {
    if (isViewMode) return;
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleOpenAddVariant = () => {
    if (isViewMode) return;
    setEditingVariant(null);
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = (attr: VariantAttribute) => {
    if (isViewMode) return;
    setEditingVariant(attr);
    setIsVariantModalOpen(true);
  };

  const handleConfirmVariant = (updatedAttributes: VariantAttribute[]) => {
    setProductVariants((prev) => {
      const newVariants = [...prev];
      updatedAttributes.forEach((newAttr) => {
        const existingIndex = newVariants.findIndex((v) => v.id === newAttr.id);
        if (existingIndex >= 0) {
          // Nếu thuộc tính đã có trên bảng, update lại danh sách values
          newVariants[existingIndex] = {
            ...newVariants[existingIndex],
            values: newAttr.values,
          };
        } else {
          // Nếu thuộc tính mới hoàn toàn, push xuống cuối
          newVariants.push(newAttr);
        }
      });
      return newVariants;
    });
    setIsVariantModalOpen(false);
  };

  const handleSaveClick = () => {
    if (!formData.categoryId) {
      setCategoryError("Vui lòng chọn ít nhất một danh mục cho sản phẩm.");
      return;
    }
    setCategoryError("");
    onSave(formData, tags, localPricing);
  };

  // Mở modal SetPrice
  const handleOpenSetPrice = (item: PricingItem) => {
    setEditingPriceItem(item);
    setIsSetPriceModalOpen(true);
  };

  // Lưu giá mới từ modal và chuyển status về draft (bao gồm cả khi đang rejected)
  const handleSavePrice = (newPrice: number) => {
    if (editingPriceItem) {
      setLocalPricing((prev) =>
        prev.map((item) =>
          item.id === editingPriceItem.id
            ? { ...item, price: newPrice, status: "draft" }
            : item,
        ),
      );
    }
    setIsSetPriceModalOpen(false);
  };

  // Nộp duyệt từng dòng
  const handleSubmitSinglePrice = (id: string) => {
    setLocalPricing((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "pending" } : item,
      ),
    );
  };

  // Duyệt dành cho Admin
  const handleApproveSinglePrice = (id: string) => {
    setLocalPricing((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "approved" } : item,
      ),
    );
  };

  // Từ chối dành cho Admin
  const handleRejectSinglePrice = (id: string) => {
    setLocalPricing((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "rejected" } : item,
      ),
    );
  };

  // Nhân viên ấn xem chi tiết duyệt giá
  const handleViewApproval = () => {
    // navigate("/price-management"); // Mở comment này khi có trang Price Management
    alert("Chức năng Price Management đang phát triển");
  };

  // kiểm tra trạng thái bảng để render nút và badge
  // check theo trạng thái "pending" mới
  const hasPendingApproval = localPricing.some((p) => p.status === "pending");
  const categoryPath = formData.categoryId
    ? findCategoryPath(MOCK_CATEGORIES, formData.categoryId)?.join(" > ")
    : "";

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
          setFormData((prev) => ({ ...prev, categoryId: node.id }));
          setCategoryError("");
          setIsTreeOpen(false);
        }
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
          setFormData((prev) => ({ ...prev, categoryId: node.id }));
          setCategoryError("");
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
              onChange={handleInputChange}
              disabled={isViewMode}
            />
          </div>
          <div className="pf-input-group">
            <label>Product Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isViewMode}
            />
          </div>
          <div className="pf-input-group">
            <label>Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={isViewMode}
              className="pf-custom-select"
            >
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="pf-input-group pf-col-span-full">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
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
                {localPricing.map((item) => (
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
                                onClick={() => handleOpenSetPrice(item)}
                              >
                                <EditPenIcon />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="pf-btn-action blue"
                                disabled={item.status === "rejected"}
                                onClick={() => handleSubmitSinglePrice(item.id)}
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
                                  onClick={() =>
                                    handleApproveSinglePrice(item.id)
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="pf-btn-action red"
                                  onClick={() =>
                                    handleRejectSinglePrice(item.id)
                                  }
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
                                onClick={handleViewApproval}
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
                onClick={handleViewApproval}
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
                          onClick={() => handleOpenEditVariant(attr)}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
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
              onClick={handleOpenAddVariant}
            >
              Add Variant Option
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
                  <button type="button" onClick={() => removeTag(tag)}>
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
          <button type="button" className="pf-btn-outline" onClick={onCancel}>
            Back to List
          </button>
        ) : (
          <>
            <button type="button" className="pf-btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="pf-btn-primary"
              onClick={handleSaveClick}
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
            onConfirm={(newTags) => setTags(newTags)}
          />

          <VariantModal
            isOpen={isVariantModalOpen}
            onClose={() => setIsVariantModalOpen(false)}
            initialAttribute={editingVariant}
            availableAttributes={MOCK_AVAILABLE_ATTRIBUTES}
            existingVariants={productVariants}
            onConfirm={handleConfirmVariant}
          />

          <SetPriceModal
            isOpen={isSetPriceModalOpen}
            onClose={() => setIsSetPriceModalOpen(false)}
            productName={formData.name || "N/A"}
            sku={formData.sku || "N/A"}
            initialPrice={editingPriceItem?.price || 0}
            onSave={handleSavePrice}
          />
        </>
      )}
    </div>
  );
}
