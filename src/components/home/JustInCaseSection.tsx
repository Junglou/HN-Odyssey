// imports
import { useJustInCaseConfig } from "../../hooks/home/useJustInCaseConfig";
import type { ConfigElement } from "../../hooks/home/useJustForYouSlider";
import "./JustInCaseSection.css";

// helpers
const processStyle = (style?: React.CSSProperties): React.CSSProperties => {
  if (!style) return {};
  const processed: Record<string, string | number> = {};

  Object.entries(style).forEach(([key, value]) => {
    if (typeof value === "string" && value.includes("px")) {
      processed[key] = value.replace(
        /(\d+(\.\d+)?)px/g,
        (_, num) => `${(parseFloat(num) / 1920) * 100}vw`,
      );
    } else {
      processed[key] = value as string | number;
    }
  });

  return processed as React.CSSProperties;
};

const renderContentElement = (el: ConfigElement) => {
  const leftPercent = (el.x / 1920) * 100;
  const topPercent = (el.y / 800) * 100; // Hệ quy chiếu cao 800px cho canvas động
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 800) * 100;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    ...processStyle(el.style),
  };

  switch (el.type) {
    case "heading":
      return (
        <h3 key={el.id} style={baseStyle}>
          {el.content}
        </h3>
      );
    case "text":
      return (
        <p key={el.id} style={baseStyle}>
          {el.content}
        </p>
      );
    case "image":
      return (
        <img
          key={el.id}
          src={el.content}
          alt=""
          style={{ ...baseStyle, objectFit: "cover" }}
        />
      );
    case "button":
      return (
        <button key={el.id} className="jic-dynamic-btn" style={baseStyle}>
          {el.content}
        </button>
      );
    default:
      return (
        <div key={el.id} style={baseStyle}>
          {el.content}
        </div>
      );
  }
};

// container
export default function JustInCaseSection() {
  const { configData } = useJustInCaseConfig();

  // render
  return (
    <section className="jic-main-container">
      {/* static separator section */}
      <div className="jic-text-wrapper">
        <h2 className="jic-title">Just in case</h2>
        <p className="jic-subtitle">
          “Prepared for the unexpected, so you can respond with confidence when
          every moment matters.”
        </p>
      </div>

      {/* dynamic canvas content */}
      <div className="jic-canvas-wrapper">
        <div
          className="jic-background-layer"
          style={{ backgroundColor: configData.backgroundColor }}
        />
        <div className="jic-canvas-inner">
          {configData.elements.map(renderContentElement)}
        </div>
      </div>
    </section>
  );
}
