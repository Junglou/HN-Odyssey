import React from "react";
import { useKidsSectionConfig } from "../../hooks/home/useKidsSectionConfig";
import type { ConfigElement } from "../../hooks/home/useJustForYouSlider";
import type { SectionConfig } from "../../hooks/portal/Communication/ContentConfig/useContentConfig";
import "./KidsSection.css";

const getSafeImageUrl = (url?: string): string => {
  if (!url) return "https://placehold.co/400x300/e5e7eb/9ca3af?text=No+Image";
  // Nếu đã là link Cloudinary hoặc link web hoàn chỉnh thì trả về luôn
  if (url.startsWith("http") || url.startsWith("data:")) return url;

  // Nếu lỡ sót link /uploads/ cũ
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const serverRootUrl = baseUrl.replace(/\/api.*$/, "").replace(/\/$/, "");
  return `${serverRootUrl}${url.startsWith("/") ? url : `/${url}`}`;
};

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
  const topPercent = (el.y / 738) * 100;
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 738) * 100;

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
          src={getSafeImageUrl(el.content)}
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
        <a
          key={el.id}
          href={el.link || "#"} // Kích hoạt thuộc tính URL hành động từ Database
          className="dynamic-btn-hover"
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none", // Đảm bảo chữ không bị gạch chân mặc định của thẻ <a>
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

export default function KidsSection({
  dbSection,
}: {
  dbSection?: SectionConfig | null;
}) {
  const { configData } = useKidsSectionConfig(dbSection);

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
