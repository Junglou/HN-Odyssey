import React from "react";
import {
  useJustForYouSlider,
  type ConfigElement,
} from "../../hooks/home/useJustForYouSlider";
import type { SectionConfig } from "../../hooks/portal/Communication/ContentConfig/useContentConfig";
import "./JustForYou.css";

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

// Hàm mới: Quét sâu vào mã HTML của SunEditor để chuyển px thành vw
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
  const topPercent = (el.y / 900) * 100;
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 900) * 100;

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

export default function JustForYou({
  dbSlides,
}: {
  dbSlides?: SectionConfig[];
}) {
  const { slides, currentIndex, goToSlide } = useJustForYouSlider(dbSlides);

  return (
    <section className="jfy-container">
      <div className="jfy-text-wrapper">
        <h2 className="jfy-title">Just for you</h2>
        <p className="jfy-subtitle">“Created with your story in mind...”</p>
      </div>
      <div className="jfy-slider-window">
        <div
          className="jfy-slider-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="jfy-slide-item"
              style={{
                backgroundImage: `url("${slide.backgroundUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                className="jfy-canvas-layer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                {slide.elements.map(renderContentElement)}
              </div>
            </div>
          ))}
        </div>
        <div className="jfy-dots-container">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`jfy-dot ${idx === currentIndex ? "active" : ""}`}
              onClick={() => goToSlide(idx)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
