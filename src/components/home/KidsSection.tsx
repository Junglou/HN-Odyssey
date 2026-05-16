import { useKidsSectionConfig } from "../../hooks/home/useKidsSectionConfig";
import type { ConfigElement } from "../../hooks/home/useJustForYouSlider";
import "./KidsSection.css";

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
  const topPercent = (el.y / 738) * 100;
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 738) * 100;

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
        <button key={el.id} className="ks-dynamic-btn" style={baseStyle}>
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

export default function KidsSection() {
  const { configData } = useKidsSectionConfig();

  return (
    <section className="ks-main-container">
      <div className="ks-text-wrapper">
        <h2 className="ks-title">For Your Little Ones</h2>
        <p className="ks-subtitle">
          “Crafted to embrace every moment of childhood, each choice brings
          comfort, joy, and the little sparks of wonder that help your little
          ones grow, explore, and shine in their own special way.”
        </p>
      </div>

      <div className="ks-canvas-wrapper">
        <div
          className="ks-background-layer"
          style={{ backgroundColor: configData.backgroundColor }}
        />

        <div className="ks-canvas-inner">
          {configData.elements.map(renderContentElement)}
        </div>
      </div>
    </section>
  );
}
