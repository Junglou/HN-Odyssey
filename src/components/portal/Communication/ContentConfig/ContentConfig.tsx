// imports
import { useState, useRef, useEffect } from "react";
import Moveable from "react-moveable";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import "./ContentConfig.css";
import SidebarModules from "./SidebarModules";
import PropertyPanel from "./PropertyPanel";
import {
  SaveIcon,
  TrashIcon,
  DropdownIcon,
} from "../../../../assets/icons/ContentConfigIcons";
import type {
  PageType,
  SectionConfig,
  EditorElement,
  ElementType,
} from "../../../../hooks/portal/Communication/ContentConfig/useContentConfig";

// helpers
function EditorDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
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

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="cc-custom-dropdown" ref={dropdownRef}>
      <div
        className={`cc-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasMounted) setHasMounted(true);
        }}
      >
        <span>{selectedOption?.label || "Select..."}</span>
        <div className={`cc-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <DropdownIcon />
        </div>
      </div>

      <div
        className={`cc-dropdown-options ${isOpen ? "open" : hasMounted ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`cc-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

// props
interface ContentConfigProps {
  selectedPage: PageType;
  selectedSectionId: string;
  currentSection: SectionConfig | null;
  selectedElementId: string | null;
  availableSections: SectionConfig[];
  activeElementData: EditorElement | null;
  actions: {
    changePage: (page: PageType) => void;
    changeSection: (id: string) => void;
    selectElement: (id: string | null) => void;
    addElement: (
      type: ElementType,
      x: number,
      y: number,
      content?: string,
    ) => void;
    updateElementPosition: (id: string, x: number, y: number) => void;
    updateElementProperties: (
      id: string,
      updates: Partial<EditorElement>,
    ) => void;
    removeElement: (id: string) => void;
    duplicateElement: (id: string) => void;
    undo: () => void;
    saveConfig: () => void;
    updateSectionBackground: (url: string) => void;
    reorderElement: (
      elementId: string,
      direction: "front" | "back" | "up" | "down",
    ) => void;
  };
}

// constants
const PAGE_OPTIONS: { value: PageType; label: string }[] = [
  { value: "homepage", label: "Homepage" },
  { value: "about_us", label: "About Us" },
  { value: "contact", label: "Contact Us" },
  { value: "product_page", label: "Product Detail" },
  { value: "global", label: "Global Components" },
];

// component
export default function ContentConfig({
  selectedPage,
  selectedSectionId,
  currentSection,
  selectedElementId,
  availableSections,
  activeElementData,
  actions,
}: ContentConfigProps) {
  // refs & states
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const [isDragOver, setIsDragOver] = useState(false);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [moveableTarget, setMoveableTarget] = useState<HTMLElement | null>(
    null,
  );

  // Auto-fit Zoom
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (wrapperRef.current && selectedSectionId) {
      const { clientWidth, clientHeight } = wrapperRef.current;
      const availableWidth = clientWidth - 80;
      const availableHeight = clientHeight - 80;

      const scaleX = availableWidth / 1200;
      const scaleY = availableHeight / 600;

      const minScale = Math.min(scaleX, scaleY);

      timer = setTimeout(() => {
        setScale(minScale < 1 ? Number(minScale.toFixed(2)) : 1);
      }, 0);
    }

    return () => clearTimeout(timer);
  }, [selectedSectionId, isPreviewMode]);

  // effects
  useEffect(() => {
    const handleClickOutsideEditor = (e: MouseEvent) => {
      if (editingElementId) {
        const editorWrapper = document.getElementById(
          `editor-wrapper-${editingElementId}`,
        );
        if (editorWrapper && !editorWrapper.contains(e.target as Node)) {
          setEditingElementId(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutsideEditor, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutsideEditor, true);
  }, [editingElementId]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale((s) =>
          Number(
            Math.min(Math.max(0.2, s + (e.deltaY > 0 ? -0.1 : 0.1)), 3).toFixed(
              2,
            ),
          ),
        );
      }
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning && wrapperRef.current) {
        wrapperRef.current.scrollLeft =
          panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
        wrapperRef.current.scrollTop =
          panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
      }
    };
    const handleMouseUp = () => setIsPanning(false);

    if (isPanning) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable ||
        editingElementId
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        actions.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedElementId && !isPreviewMode)
          actions.duplicateElement(selectedElementId);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedElementId && !isPreviewMode)
          actions.removeElement(selectedElementId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, selectedElementId, isPreviewMode, editingElementId]);

  // Target DOM tracking
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (selectedElementId && !isPreviewMode) {
      timer = setTimeout(() => {
        const el = document.getElementById(`el-${selectedElementId}`);
        setMoveableTarget(el);
      }, 10);
    } else {
      timer = setTimeout(() => {
        setMoveableTarget(null);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [selectedElementId, isPreviewMode, currentSection?.elements]);

  // handlers
  const handleWrapperMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      if (wrapperRef.current)
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: wrapperRef.current.scrollLeft,
          scrollTop: wrapperRef.current.scrollTop,
        };
    } else if (e.button === 0) {
      const target = e.target as Element;
      if (
        !target.closest(".cc-element") &&
        !target.closest(".se-wrapper") &&
        !target.closest(".moveable-control-box")
      ) {
        if (!isPreviewMode) {
          actions.selectElement(null);
          setEditingElementId(null);
        }
      }
    }
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const dropX = Math.round((e.clientX - canvasRect.left) / scale / 10) * 10;
    const dropY = Math.round((e.clientY - canvasRect.top) / scale / 10) * 10;
    const newType = e.dataTransfer.getData(
      "application/new-element",
    ) as ElementType;
    if (newType) actions.addElement(newType, dropX, dropY);
  };

  // PHÂN TÁCH CHẾ ĐỘ UX
  const isEditingShape =
    editingElementId === selectedElementId &&
    ["rectangle", "ellipse"].includes(activeElementData?.type || "");
  const isEditingText =
    editingElementId === selectedElementId &&
    !["rectangle", "ellipse"].includes(activeElementData?.type || "");

  // render
  return (
    <div className="cc-container">
      <div className="cc-header">
        <div>
          <h1 className="cc-title">Content Config</h1>
          <p className="cc-breadcrumb">
            Communication / Global Section Builder
          </p>
        </div>
        <div className="cc-header-actions">
          <button
            className="cc-btn-outline"
            style={{
              backgroundColor: isPreviewMode ? "#111827" : "#fff",
              color: isPreviewMode ? "#fff" : "#374151",
              borderColor: isPreviewMode ? "#111827" : "#d1d5db",
            }}
            onClick={() => {
              setIsPreviewMode(!isPreviewMode);
              actions.selectElement(null);
            }}
          >
            {isPreviewMode ? "Edit Mode" : "Preview Mode"}
          </button>
          <button
            className="cc-btn-outline"
            onClick={actions.undo}
            title="Ctrl + Z"
            disabled={isPreviewMode}
          >
            Undo
          </button>
          <button
            className="cc-btn-save"
            onClick={actions.saveConfig}
            disabled={isPreviewMode}
          >
            <SaveIcon /> Save
          </button>
        </div>
      </div>

      <div className="cc-filters-row">
        <EditorDropdown
          value={selectedPage}
          options={PAGE_OPTIONS}
          onChange={(val) => actions.changePage(val as PageType)}
        />
        <EditorDropdown
          value={selectedSectionId}
          options={availableSections.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
          onChange={actions.changeSection}
        />
      </div>

      <div
        className={`cc-workspace ${isPreviewMode ? "preview-layout" : ""}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!isPreviewMode && <SidebarModules actions={actions} />}

        <div
          className={`cc-canvas-area ${isDragOver ? "drag-over" : ""} ${isPreviewMode ? "cc-preview-mode" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isPreviewMode) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            if (!isPreviewMode) handleDropOnCanvas(e);
          }}
          onMouseDown={handleWrapperMouseDown}
        >
          {currentSection ? (
            <>
              <div
                className={`cc-canvas-wrapper ${isPanning ? "panning" : ""}`}
                ref={wrapperRef}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div
                  className="cc-canvas-container"
                  style={{ width: 1200 * scale, height: 600 * scale }}
                >
                  <div
                    ref={canvasRef}
                    className="cc-canvas"
                    style={{
                      width: 1200,
                      height: 600,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      backgroundImage: `url(${currentSection.backgroundUrl})`,
                    }}
                  >
                    {currentSection.elements.length === 0 && !isPreviewMode && (
                      <div
                        className="cc-empty-state"
                        style={{ paddingTop: "20%" }}
                      >
                        Kéo thả module vào đây để bắt đầu.
                      </div>
                    )}

                    {currentSection.elements.map((el, index) => (
                      <div
                        key={el.id}
                        id={`el-${el.id}`}
                        className={`cc-element ${selectedElementId === el.id ? "selected" : ""} ${el.type === "dropcap" ? "cc-element-dropcap" : ""} ${el.type === "animated" ? "cc-element-animated" : ""} ${isPreviewMode ? "is-preview" : ""}`}
                        style={{
                          left: `${el.x}px`,
                          top: `${el.y}px`,
                          width: `${el.width}px`,
                          height: `${el.height}px`,
                          zIndex: editingElementId === el.id ? 9999 : index + 1,
                          transform: `rotate(${el.rotate || 0}deg) ${el.style?.transform || ""}`,
                          transformOrigin: "center center",
                          ...el.style,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isPreviewMode) {
                            actions.selectElement(el.id);
                            // Clear trạng thái Edit nếu click sang hình khác
                            if (editingElementId !== el.id)
                              setEditingElementId(null);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (
                            !isPreviewMode &&
                            [
                              "text",
                              "button",
                              "heading",
                              "blockquote",
                              "textlink",
                              "rectangle", // Hỗ trợ Double Click cho Shape
                              "ellipse", // Hỗ trợ Double Click cho Shape
                            ].includes(el.type)
                          )
                            setEditingElementId(el.id);
                        }}
                      >
                        {/* ẨN NÚT XÓA KHI ĐANG TRONG CHẾ ĐỘ EDIT CLIP-PATH HOẶC SUN-EDITOR */}
                        {!isPreviewMode &&
                          selectedElementId === el.id &&
                          editingElementId !== el.id && (
                            <div
                              className="cc-element-handle"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <button
                                className="cc-element-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  actions.removeElement(el.id);
                                }}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}

                        {el.type === "image" ? (
                          <img
                            src={el.content}
                            alt="element"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              pointerEvents: "none",
                              borderRadius: "inherit",
                            }}
                          />
                        ) : el.type === "video-link" ? (
                          <iframe
                            src={el.content}
                            title="Video Link"
                            width="100%"
                            height="100%"
                            style={{
                              border: "none",
                              pointerEvents: isPreviewMode ? "auto" : "none",
                              borderRadius: "inherit",
                            }}
                            allowFullScreen
                          />
                        ) : el.type === "video-upload" ? (
                          <video
                            src={el.content}
                            width="100%"
                            height="100%"
                            controls
                            style={{
                              pointerEvents: isPreviewMode ? "auto" : "none",
                              objectFit: "cover",
                              borderRadius: "inherit",
                            }}
                          />
                        ) : el.type === "rectangle" || el.type === "ellipse" ? (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: el.style?.backgroundColor,
                              borderRadius: "inherit",
                            }}
                          />
                        ) : editingElementId === el.id ? (
                          <div
                            id={`editor-wrapper-${el.id}`}
                            className="cc-suneditor-wrapper"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SunEditor
                              setContents={el.content}
                              onChange={(content) =>
                                actions.updateElementProperties(el.id, {
                                  content: content,
                                })
                              }
                              setOptions={{
                                minHeight: "100px",
                                resizingBar: false,
                                buttonList: [
                                  ["font", "fontSize", "formatBlock"],
                                  ["bold", "underline", "italic", "strike"],
                                  ["fontColor", "hiliteColor", "align", "list"],
                                  ["link", "table", "removeFormat"],
                                ],
                              }}
                            />
                            <button
                              className="cc-suneditor-done-btn"
                              onClick={() => setEditingElementId(null)}
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cc-content-wrapper"
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: ["button", "textlink"].includes(
                                el.type,
                              )
                                ? "center"
                                : "flex-start",
                              pointerEvents: "none",
                            }}
                            dangerouslySetInnerHTML={{ __html: el.content }}
                          />
                        )}
                      </div>
                    ))}

                    {!isPreviewMode && moveableTarget && (
                      <Moveable
                        target={moveableTarget}
                        zIndex={9999}
                        draggable={!isEditingText && !isEditingShape}
                        resizable={!isEditingText && !isEditingShape}
                        rotatable={!isEditingText && !isEditingShape}
                        clippable={isEditingShape}
                        defaultClipPath={
                          activeElementData?.style?.clipPath ||
                          "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"
                        }
                        clipType="polygon"
                        clipRelative={true}
                        clipArea={true}
                        dragWithClip={true}
                        onClip={(e) => {
                          e.target.style.clipPath = e.clipStyle;
                        }}
                        onClipEnd={(e) => {
                          actions.updateElementProperties(
                            selectedElementId as string,
                            {
                              style: {
                                clipPath: (e.target as HTMLElement).style
                                  .clipPath,
                              },
                            },
                          );
                        }}
                        snappable={true}
                        snapRotationThreshold={15}
                        rotationPosition="top"
                        origin={false}
                        onDrag={(e) => {
                          e.target.style.left = `${e.left}px`;
                          e.target.style.top = `${e.top}px`;
                        }}
                        onDragEnd={(e) => {
                          const target = e.target as HTMLElement;
                          actions.updateElementPosition(
                            selectedElementId as string,
                            parseFloat(target.style.left),
                            parseFloat(target.style.top),
                          );
                        }}
                        onResize={(e) => {
                          e.target.style.width = `${e.width}px`;
                          e.target.style.height = `${e.height}px`;
                          e.target.style.left = `${e.drag.left}px`;
                          e.target.style.top = `${e.drag.top}px`;
                        }}
                        onResizeEnd={(e) => {
                          const target = e.target as HTMLElement;
                          actions.updateElementProperties(
                            selectedElementId as string,
                            {
                              width: parseFloat(target.style.width),
                              height: parseFloat(target.style.height),
                            },
                          );
                          actions.updateElementPosition(
                            selectedElementId as string,
                            parseFloat(target.style.left),
                            parseFloat(target.style.top),
                          );
                        }}
                        onRotate={(e) => {
                          e.target.style.transform = `rotate(${e.absoluteRotation}deg)`;
                        }}
                        onRotateEnd={(e) => {
                          const target = e.target as HTMLElement;
                          const match = target.style.transform.match(
                            /rotate\(([\d.-]+)deg\)/,
                          );
                          if (match)
                            actions.updateElementProperties(
                              selectedElementId as string,
                              { rotate: parseFloat(match[1]) },
                            );
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="cc-zoom-toolbar">
                <button
                  className="cc-zoom-btn"
                  onClick={() =>
                    setScale((s) => Number(Math.max(0.2, s - 0.1).toFixed(2)))
                  }
                >
                  {" "}
                  -{" "}
                </button>
                <span className="cc-zoom-value">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  className="cc-zoom-btn"
                  onClick={() =>
                    setScale((s) => Number(Math.min(3, s + 0.1).toFixed(2)))
                  }
                >
                  {" "}
                  +{" "}
                </button>
              </div>
            </>
          ) : (
            <div className="cc-empty-state" style={{ marginTop: "50px" }}>
              No section selected
            </div>
          )}
        </div>

        {!isPreviewMode && (
          <PropertyPanel
            currentSection={currentSection}
            activeElementData={activeElementData}
            actions={actions}
          />
        )}
      </div>
    </div>
  );
}
