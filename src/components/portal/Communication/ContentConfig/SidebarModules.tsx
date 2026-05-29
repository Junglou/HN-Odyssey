import { useRef } from "react";
import { toast } from "react-toastify";
import "./SidebarModules.css";
import { useSidebarModule } from "../../../../hooks/portal/Communication/ContentConfig/useSidebarModule";
import {
  TextIcon,
  ButtonIcon,
  ImageIcon,
  UploadIcon,
  SearchIcon,
  ChevronIcon,
  HeadingIcon,
  BadgeIcon,
  BlockquoteIcon,
  DropcapIcon,
  AnimatedIcon,
  TextLinkIcon,
  DividerIcon,
  VideoLinkIcon,
  VideoUploadIcon,
  RectangleIcon,
  EllipseIcon,
} from "../../../../assets/icons/ContentConfigIcons";
import type { ElementType } from "../../../../hooks/portal/Communication/ContentConfig/useContentConfig";
import axiosClient from "../../../../api/axiosClient";

// Định nghĩa kiểu dữ liệu cho props
interface SidebarModulesProps {
  actions: {
    addElement: (
      type: ElementType,
      x: number,
      y: number,
      content?: string,
    ) => void;
  };
}

// Hàm xử lý đường dẫn media trả về từ Backend để tránh lỗi đường dẫn tương đối
const getFullMediaUrl = (path: string) => {
  if (path.startsWith("/")) {
    const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");
    return baseUrl + path;
  }
  return path;
};

// Component SidebarModules
export default function SidebarModules({ actions }: SidebarModulesProps) {
  // Khởi tạo các hooks và refs
  const {
    searchQuery,
    setSearchQuery,
    expandedCategories,
    toggleCategory,
    filteredCategories,
  } = useSidebarModule();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Hàm hỗ trợ render icon dựa trên id
  const renderIcon = (iconId: string) => {
    switch (iconId) {
      case "heading":
        return <HeadingIcon />;
      case "badge":
        return <BadgeIcon />;
      case "blockquote":
        return <BlockquoteIcon />;
      case "dropcap":
        return <DropcapIcon />;
      case "animated":
        return <AnimatedIcon />;
      case "text":
        return <TextIcon />;
      case "button":
        return <ButtonIcon />;
      case "image":
        return <ImageIcon />;
      case "upload":
        return <UploadIcon />;
      case "textlink":
        return <TextLinkIcon />;
      case "divider":
        return <DividerIcon />;
      case "video-link":
        return <VideoLinkIcon />;
      case "video-upload":
        return <VideoUploadIcon />;
      case "rectangle":
        return <RectangleIcon />;
      case "ellipse":
        return <EllipseIcon />;
      default:
        return null;
    }
  };

  // Các hàm xử lý sự kiện
  const handleDragStartNew = (e: React.DragEvent, type: ElementType) => {
    e.dataTransfer.setData("application/new-element", type);
  };

  // Hàm xử lý gọi API upload ảnh từ thiết bị lên server
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("Đang tải ảnh lên, vui lòng đợi...");
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await axiosClient.post(
          "/marketing/content/page-configs/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        const url = getFullMediaUrl(res.data.data.url);
        actions.addElement("image", 0, 0, url);
        toast.success("Tải ảnh lên thành công!");
      } catch (err) {
        console.error("Upload error", err);
        toast.error("Có lỗi xảy ra khi tải ảnh lên. Vui lòng thử lại sau.");
      }

      // Xóa giá trị input để có thể chọn lại cùng một file trong lần tiếp theo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Hàm xử lý gọi API upload video từ thiết bị lên server
  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info("Đang tải video lên, vui lòng đợi...");
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await axiosClient.post(
          "/marketing/content/page-configs/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        const url = getFullMediaUrl(res.data.data.url);
        actions.addElement("video-upload", 0, 0, url);
        toast.success("Tải video lên thành công!");
      } catch (err) {
        console.error("Upload error", err);
        toast.error("Có lỗi xảy ra khi tải video lên. Vui lòng thử lại sau.");
      }

      // Xóa giá trị input để tránh bị cache thao tác chọn file
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // Render giao diện component
  return (
    <div className="sbm-sidebar">
      <h3 className="sbm-sidebar-title">Modules</h3>

      {/* Thanh tìm kiếm module */}
      <div className="sbm-sidebar-search">
        <span className="sbm-search-icon">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search modules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sbm-search-input"
        />
      </div>

      {/* Danh sách các chuyên mục module */}
      <div className="sbm-sidebar-content">
        {filteredCategories.length === 0 ? (
          <div className="sbm-empty-state">No modules found.</div>
        ) : (
          filteredCategories.map((cat) => {
            const isOpen = expandedCategories.includes(cat.id);
            return (
              <div key={cat.id} className="sbm-sidebar-category">
                <div
                  className="sbm-category-header"
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="sbm-category-title">{cat.title}</span>
                  <span
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.3s ease",
                      display: "flex",
                    }}
                  >
                    <ChevronIcon />
                  </span>
                </div>

                <div className={`sbm-category-body ${isOpen ? "open" : ""}`}>
                  <div className="sbm-category-body-inner">
                    <div className="sbm-tool-grid">
                      {cat.modules.map((mod) => (
                        <div
                          key={mod.id}
                          className="sbm-tool-item"
                          draggable={mod.actionType === "drag"}
                          onDragStart={
                            mod.actionType === "drag"
                              ? (e) => handleDragStartNew(e, mod.type)
                              : undefined
                          }
                          onClick={
                            mod.actionType === "click"
                              ? () => {
                                  if (mod.id === "mod-upload")
                                    fileInputRef.current?.click();
                                  if (mod.id === "mod-video-upload")
                                    videoInputRef.current?.click();
                                }
                              : undefined
                          }
                        >
                          {renderIcon(mod.iconId)} {mod.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input file ẩn dùng để trigger hộp thoại tải tệp */}
      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept="image/*"
        onChange={handleUploadImage}
      />
      <input
        type="file"
        ref={videoInputRef}
        hidden
        accept="video/*"
        onChange={handleUploadVideo}
      />

      {/* Thông tin phím tắt hỗ trợ */}
      <div className="sbm-sidebar-shortcuts">
        <div className="sbm-shortcuts-title">Shortcuts:</div>
        <div className="sbm-shortcuts-list">
          <div className="sbm-shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Z</kbd> : Undo
          </div>
          <div className="sbm-shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>D</kbd> : Clone
          </div>
          <div className="sbm-shortcut-item">
            <kbd>Del</kbd> : Remove Element
          </div>
          <div className="sbm-shortcut-item">
            <kbd>Right Click</kbd> : Pan Canvas
          </div>
          <div className="sbm-shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Wheel</kbd> : Zoom
          </div>
        </div>
      </div>
    </div>
  );
}
