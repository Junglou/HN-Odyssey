import { useState } from "react";
import "./TagDrawer.css";

// import type từ hook
import type {
  Tag,
  TagFormData,
} from "../../../../hooks/portal/ProductCatalog/TagManagement/useTagManagement";

interface TagDrawerProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData: Tag | null;
  onClose: () => void;
  onSubmit: (data: TagFormData) => void;
}

// 1. Component vỏ bọc: Quản lý việc mount/unmount để reset state tự nhiên
export default function TagDrawer(props: TagDrawerProps) {
  // Nếu đang đóng, không render gì cả -> Hủy hoàn toàn component con
  if (!props.isOpen) return null;

  // Dùng thuộc tính 'key' dựa vào ID để ép React làm mới form mỗi khi đổi tag khác nhau
  const formKey = props.initialData?.id || "new-tag";

  return <TagDrawerContent key={formKey} {...props} />;
}

// 2. Component nội dung thực sự: Không cần useEffect
function TagDrawerContent({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: TagDrawerProps) {
  // Khởi tạo state trực tiếp từ props. Nó chỉ chạy 1 lần khi mở Drawer.
  const [formData, setFormData] = useState<TagFormData>(() => {
    if (mode === "edit" && initialData) {
      return {
        name: initialData.name,
        description: initialData.description,
        status: initialData.status,
      };
    }
    return {
      name: "",
      description: "",
      status: "Active",
    };
  });

  return (
    <>
      {/* lớp phủ nền đen mờ */}
      <div className="td-overlay" onClick={onClose}></div>

      {/* khối nội dung trượt từ phải sang */}
      <div className={`td-container ${isOpen ? "open" : ""}`}>
        <div className="td-header">
          <button
            type="button"
            className="td-back-btn"
            onClick={(e) => {
              onClose();
              e.currentTarget.blur();
            }}
            aria-label="Close drawer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111827"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h2 className="td-title">
            {mode === "add" ? "Add Tag" : "Edit Tag"}
          </h2>
          {/* div trống để cân bằng 2 bên cho flexbox */}
          <div style={{ width: "24px" }}></div>
        </div>

        <div className="td-body">
          <div className="td-form-group">
            <label>
              Tag Name <span className="td-required">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Summer Collection"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="td-form-group">
            <label>Description</label>
            <textarea
              placeholder="Mô tả ngắn về nhãn này..."
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            ></textarea>
          </div>

          <div className="td-form-group">
            <label>Tag Status</label>
            <div className="td-status-toggle-wrapper">
              <button
                type="button"
                role="switch"
                aria-checked={formData.status === "Active"}
                className={`td-toggle-switch ${formData.status === "Active" ? "on" : ""}`}
                onClick={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    status: prev.status === "Active" ? "Inactive" : "Active",
                  }));
                  e.currentTarget.blur();
                }}
              ></button>
              <span className="td-status-label">{formData.status}</span>
            </div>
          </div>
        </div>

        <div className="td-footer">
          <button
            type="button"
            className="td-btn-cancel"
            onClick={(e) => {
              onClose();
              e.currentTarget.blur();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="td-btn-submit"
            onClick={(e) => {
              if (!formData.name.trim()) {
                alert("Vui lòng nhập Tag Name!");
                return;
              }
              onSubmit(formData);
              e.currentTarget.blur();
            }}
          >
            {mode === "add" ? "Create Tag" : "Save Tag"}
          </button>
        </div>
      </div>
    </>
  );
}
