// imports
import { useOtherHalfConfig } from "../../hooks/home/useOtherHalfConfig";
import type { ConfigElement } from "../../hooks/home/useJustForYouSlider";
import "./OtherHalfSection.css";

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
  // Chia tỷ lệ theo khung chuẩn 1920x990
  const leftPercent = (el.x / 1920) * 100;
  const topPercent = (el.y / 990) * 100;
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 990) * 100;

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
        <button key={el.id} style={baseStyle} className="oh-dynamic-btn">
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
export default function OtherHalfSection() {
  const { configData } = useOtherHalfConfig();

  // render
  return (
    <section className="oh-main-container">
      <div className="oh-text-wrapper">
        <h2 className="oh-title">For Your Other Half</h2>
        <p className="oh-subtitle">
          “Crafted to stand beside every shared adventure, each piece brings
          strength, comfort, and the confidence to explore, endure, and thrive
          together”
        </p>
      </div>

      <div className="oh-canvas-wrapper">
        <div
          className="oh-background-layer"
          style={{ backgroundColor: configData.backgroundColor }}
        />

        <div className="oh-canvas-inner">
          {configData.elements.map(renderContentElement)}
        </div>
      </div>
    </section>
  );
}
