// imports
import { useState, useRef, useEffect } from "react";
import "./PropertyPanel.css";
import type { EditorElement } from "../../../../hooks/portal/Communication/ContentConfig/useContentConfig";

// helpers
function CustomSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || "Select...";

  return (
    <div className="pp-form-group">
      <label className="pp-label">{label}</label>
      <div className="pp-custom-select-wrapper" ref={ref}>
        <div
          className={`pp-custom-select-trigger ${isOpen ? "active" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedLabel}</span>
          <svg
            className={`pp-select-arrow ${isOpen ? "open" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        {isOpen && (
          <div className="pp-custom-select-options">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`pp-custom-select-option ${value === opt.value ? "selected" : ""}`}
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
    </div>
  );
}

// props
interface PropertyPanelProps {
  activeElementData: EditorElement | null;
  actions: {
    updateElementProperties: (
      id: string,
      updates: Partial<EditorElement>,
    ) => void;
  };
}

// component
export default function PropertyPanel({
  activeElementData,
  actions,
}: PropertyPanelProps) {
  type TextAlignType = NonNullable<EditorElement["style"]>["textAlign"];

  // render
  return (
    <div className="pp-property-panel">
      <h3 className="pp-panel-title">Properties</h3>

      {!activeElementData ? (
        <div className="pp-empty-state">Select an element to edit</div>
      ) : (
        <div
          className="pp-property-body"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* SEO & Tag Configuration */}
          {["heading", "text", "dropcap", "animated", "blockquote"].includes(
            activeElementData.type,
          ) && (
            <CustomSelect
              label="HTML Tag (SEO)"
              value={activeElementData.tag || "p"}
              options={
                activeElementData.type === "heading" ||
                activeElementData.type === "animated"
                  ? [
                      { value: "h1", label: "Heading 1 (H1)" },
                      { value: "h2", label: "Heading 2 (H2)" },
                      { value: "h3", label: "Heading 3 (H3)" },
                      { value: "h4", label: "Heading 4 (H4)" },
                    ]
                  : activeElementData.type === "blockquote"
                    ? [{ value: "blockquote", label: "Blockquote" }]
                    : [
                        { value: "p", label: "Paragraph (P)" },
                        { value: "span", label: "Span" },
                        { value: "div", label: "Div" },
                      ]
              }
              onChange={(val) =>
                actions.updateElementProperties(activeElementData.id, {
                  tag: val,
                })
              }
            />
          )}

          {/* mirror */}
          {["image", "rectangle", "ellipse"].includes(
            activeElementData.type,
          ) && (
            <div className="pp-form-group">
              <label className="pp-label">Mirror</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="pp-input"
                  style={{
                    flex: 1,
                    cursor: "pointer",
                    backgroundColor:
                      activeElementData.style?.transform?.includes("scaleX(-1)")
                        ? "#e5e7eb"
                        : "#fff",
                  }}
                  onClick={() => {
                    const currentT = activeElementData.style?.transform || "";
                    const newT = currentT.includes("scaleX(-1)")
                      ? currentT.replace("scaleX(-1)", "")
                      : currentT + " scaleX(-1)";
                    actions.updateElementProperties(activeElementData.id, {
                      style: { transform: newT.trim() },
                    });
                  }}
                >
                  horizontal flip
                </button>
                <button
                  className="pp-input"
                  style={{
                    flex: 1,
                    cursor: "pointer",
                    backgroundColor:
                      activeElementData.style?.transform?.includes("scaleY(-1)")
                        ? "#e5e7eb"
                        : "#fff",
                  }}
                  onClick={() => {
                    const currentT = activeElementData.style?.transform || "";
                    const newT = currentT.includes("scaleY(-1)")
                      ? currentT.replace("scaleY(-1)", "")
                      : currentT + " scaleY(-1)";
                    actions.updateElementProperties(activeElementData.id, {
                      style: { transform: newT.trim() },
                    });
                  }}
                >
                  vertical flip
                </button>
              </div>
            </div>
          )}

          {/* Alignment */}
          {!["image", "divider"].includes(activeElementData.type) && (
            <CustomSelect
              label="Block Alignment"
              value={activeElementData.style?.textAlign || "left"}
              options={[
                { value: "left", label: "Left Align" },
                { value: "center", label: "Center Align" },
                { value: "right", label: "Right Align" },
                { value: "justify", label: "Justify" },
              ]}
              onChange={(val) =>
                actions.updateElementProperties(activeElementData.id, {
                  style: { textAlign: val as TextAlignType },
                })
              }
            />
          )}

          {/* Sizing (Width / Height) */}
          <div className="pp-form-group">
            <label className="pp-label">Width (px)</label>
            <input
              type="number"
              className="pp-input"
              value={Math.round(activeElementData.width)}
              onChange={(e) =>
                actions.updateElementProperties(activeElementData.id, {
                  width: Number(e.target.value),
                })
              }
            />
          </div>

          {["image", "divider"].includes(activeElementData.type) && (
            <div className="pp-form-group">
              <label className="pp-label">
                Height (px){" "}
                {activeElementData.type === "divider" ? "(Thickness)" : ""}
              </label>
              <input
                type="number"
                className="pp-input"
                value={Math.round(activeElementData.height)}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    height: Number(e.target.value),
                  })
                }
              />
            </div>
          )}

          {/* Rotation */}
          <div className="pp-form-group">
            <label className="pp-label">Rotation (deg)</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="range"
                min="0"
                max="360"
                value={activeElementData.rotate || 0}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    rotate: Number(e.target.value),
                  })
                }
                style={{ flex: 1, cursor: "pointer" }}
              />
              <input
                type="number"
                className="pp-input"
                style={{
                  width: "70px",
                  padding: "4px 8px",
                  textAlign: "center",
                }}
                value={activeElementData.rotate || 0}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    rotate: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* Background Color */}
          {["badge", "button", "divider"].includes(activeElementData.type) && (
            <div className="pp-form-group">
              <label className="pp-label">
                {activeElementData.type === "divider"
                  ? "Line Color"
                  : "Background Color"}
              </label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="color"
                  className="pp-input pp-color-input"
                  style={{ width: "50px", padding: "2px", height: "38px" }}
                  value={
                    activeElementData.style?.backgroundColor ||
                    (activeElementData.type === "divider"
                      ? "#d1d5db"
                      : "#111827")
                  }
                  onChange={(e) =>
                    actions.updateElementProperties(activeElementData.id, {
                      style: { backgroundColor: e.target.value },
                    })
                  }
                />
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#6b7280",
                    fontFamily: "monospace",
                  }}
                >
                  {activeElementData.style?.backgroundColor ||
                    (activeElementData.type === "divider"
                      ? "#d1d5db"
                      : "#111827")}
                </span>
              </div>
            </div>
          )}

          {/* Text Color (Cho Text Link) */}
          {activeElementData.type === "textlink" && (
            <div className="pp-form-group">
              <label className="pp-label">Color</label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="color"
                  className="pp-input pp-color-input"
                  style={{ width: "50px", padding: "2px", height: "38px" }}
                  value={activeElementData.style?.color || "#111827"}
                  onChange={(e) =>
                    actions.updateElementProperties(activeElementData.id, {
                      style: { color: e.target.value },
                    })
                  }
                />
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#6b7280",
                    fontFamily: "monospace",
                  }}
                >
                  {activeElementData.style?.color || "#111827"}
                </span>
              </div>
            </div>
          )}

          {/* Corner Radius */}
          {["badge", "button", "image", "rectangle", "ellipse"].includes(
            activeElementData.type,
          ) && (
            <div className="pp-form-group">
              <label className="pp-label">Corner Radius (px)</label>
              <input
                type="number"
                className="pp-input"
                placeholder="e.g. 8"
                value={parseInt(activeElementData.style?.borderRadius || "0")}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    style: { borderRadius: `${e.target.value}px` },
                  })
                }
              />
            </div>
          )}

          {/* Target Link */}
          {["button", "textlink"].includes(activeElementData.type) && (
            <div className="pp-form-group">
              <label className="pp-label">Click Action (URL)</label>
              <input
                type="text"
                className="pp-input"
                placeholder="https://..."
                value={activeElementData.link || ""}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    link: e.target.value,
                  })
                }
              />
            </div>
          )}

          {/* Image Source */}
          {activeElementData.type === "image" && (
            <div className="pp-form-group">
              <label className="pp-label">Image Source URL</label>
              <input
                type="text"
                className="pp-input"
                value={activeElementData.content || ""}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    content: e.target.value,
                  })
                }
              />
            </div>
          )}
          {/* Input Video Link */}
          {activeElementData.type === "video-link" && (
            <div className="pp-form-group">
              <label className="pp-label">Youtube/Vimeo Embed URL</label>
              <input
                type="text"
                className="pp-input"
                placeholder="https://www.youtube.com/embed/..."
                value={activeElementData.content || ""}
                onChange={(e) =>
                  actions.updateElementProperties(activeElementData.id, {
                    content: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
