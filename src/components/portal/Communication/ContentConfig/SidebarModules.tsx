// imports
import { useRef } from "react";
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
} from "../../../../assets/icons/ContentConfigIcons";
import type { ElementType } from "../../../../hooks/portal/Communication/ContentConfig/useContentConfig";

// props
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

// component
export default function SidebarModules({ actions }: SidebarModulesProps) {
  // hook & refs
  const {
    searchQuery,
    setSearchQuery,
    expandedCategories,
    toggleCategory,
    filteredCategories,
  } = useSidebarModule();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // helpers
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
      default:
        return null;
    }
  };

  // handlers
  const handleDragStartNew = (e: React.DragEvent, type: ElementType) => {
    e.dataTransfer.setData("application/new-element", type);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      actions.addElement("image", 0, 0, url);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // render
  return (
    <div className="sbm-sidebar">
      <h3 className="sbm-sidebar-title">Modules</h3>

      {/* search bar */}
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

      {/* module categories */}
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
                            mod.actionType === "click" &&
                            mod.id === "mod-upload"
                              ? () => fileInputRef.current?.click()
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

      {/* hidden upload input */}
      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept="image/*"
        onChange={handleUploadImage}
      />

      {/* shortcuts */}
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
