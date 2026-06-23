import { useState, useMemo } from "react";
import "./TagModal.css";

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];
  selectedTags: string[];
  onConfirm: (tags: string[]) => void;
}

export default function TagModal({
  isOpen,
  onClose,
  availableTags,
  selectedTags,
  onConfirm,
}: TagModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Quản lý danh sách tag được tích chọn tạm thời trong Modal
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLocalSelected([...selectedTags]);
      setSearchTerm("");
    }
  }

  // Lọc tag theo từ khóa nhập vào
  const filteredTags = useMemo(() => {
    if (!searchTerm) return availableTags;
    return availableTags.filter((tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm, availableTags]);

  const handleToggleTag = (tag: string) => {
    setLocalSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleConfirm = () => {
    onConfirm(localSelected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal-header">
          <h3 className="tm-modal-title">Choose Tags</h3>
          <button type="button" className="tm-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="tm-modal-body">
          <input
            type="text"
            placeholder="Find tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="tm-search-input"
          />
          <ul className="tm-tag-list">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag, index) => {
                // Kiểm tra xem tag này đã được tích chưa
                const isSelected = localSelected.includes(tag);
                return (
                  <li
                    key={index}
                    onClick={() => handleToggleTag(tag)}
                    className={`tm-tag-item ${isSelected ? "selected" : ""}`}
                  >
                    <span>{tag}</span>
                    {isSelected && <span>✔</span>}
                  </li>
                );
              })
            ) : (
              <li className="tm-tag-empty">No tags found</li>
            )}
          </ul>
        </div>

        <div className="tm-modal-footer">
          <button type="button" className="tm-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tm-btn-confirm"
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
