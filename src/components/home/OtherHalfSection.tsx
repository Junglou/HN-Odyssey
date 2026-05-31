import React from "react";
import { useOtherHalfConfig } from "../../hooks/home/useOtherHalfConfig";
import type { ConfigElement } from "../../hooks/home/useJustForYouSlider";
import type { SectionConfig } from "../../hooks/portal/Communication/ContentConfig/useContentConfig";
import "./OtherHalfSection.css";

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

const processHtmlContent = (html: string) => {
  if (!html) return "";
  return html.replace(
    /(\d+(\.\d+)?)px/g,
    (_, num) => `${(parseFloat(num) / 1920) * 100}vw`,
  );
};

const renderContentElement = (
  el: ConfigElement & { rotate?: number; link?: string },
) => {
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
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    transform:
      `rotate(${el.rotate || 0}deg) ${el.style?.transform || ""}`.trim() ||
      undefined,
    ...processStyle(el.style),
  };

  const cleanContent = el.content
    ? el.content.replace(/^<p[^>]*>/, "").replace(/<\/p>$/, "")
    : "";
  const finalHtml = processHtmlContent(el.content);
  const finalCleanHtml = processHtmlContent(cleanContent);

  switch (el.type) {
    case "image":
      return (
        <img
          key={el.id}
          src={el.content}
          alt=""
          style={{ ...baseStyle, objectFit: "cover" }}
        />
      );
    case "video-link":
      return (
        <iframe
          key={el.id}
          src={el.content}
          title="Video"
          style={{ ...baseStyle, border: "none" }}
          allowFullScreen
        />
      );
    case "video-upload":
      return (
        <video
          key={el.id}
          src={el.content}
          style={{ ...baseStyle, objectFit: "cover" }}
          controls
        />
      );
    case "rectangle":
    case "ellipse":
    case "divider":
      return <div key={el.id} style={baseStyle} />;
    case "textlink":
      return (
        <a
          key={el.id}
          href={el.link || "#"}
          className="dynamic-html-wrapper"
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      );
    case "button":
      return (
        <button
          key={el.id}
          className="dynamic-btn-hover"
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: finalCleanHtml }}
        />
      );
    default: {
      const Tag = (el.tag || "div") as React.ElementType;
      return (
        <Tag
          key={el.id}
          className="dynamic-html-wrapper"
          style={{
            ...baseStyle,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      );
    }
  }
};

export default function OtherHalfSection({
  dbSection,
}: {
  dbSection?: SectionConfig | null;
}) {
  const { configData } = useOtherHalfConfig(dbSection);

  return (
    <section className="oh-main-container">
      <div className="oh-text-wrapper">
        <h2 className="oh-title">For Your Other Half</h2>
        <p className="oh-subtitle">
          “Crafted to stand beside every shared adventure...”
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
