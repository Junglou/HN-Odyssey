import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useHeroBannerConfig } from "../../hooks/home/useHeroBannerConfig";

import "./HeroBanner.css";
import SmartImage from "../common/SmartImage/SmartImage";

export default function HeroBanner() {
  const { slides, currentIndex, goToSlide } = useHeroBannerConfig();
  const navigate = useNavigate();

  // Vuốt ngang để chuyển slide (trái = tiếp theo, phải = quay lại)
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || slides.length < 2) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Chỉ tính là vuốt ngang khi đủ dài và rõ ràng ngang hơn dọc (không chặn cuộn trang)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goToSlide(
      (currentIndex + (dx < 0 ? 1 : -1) + slides.length) % slides.length,
    );
  };

  // 1. KẾ THỪA URL CỦA BANNER KHI CLICK VÀO TAG
  const handleTagClick = (
    tag: string,
    targetUrl: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation(); // Chặn click lan ra banner
    // Nếu targetUrl đã có '?' (vd: /products?category=kid) thì nối thêm bằng '&'
    const separator = targetUrl.includes("?") ? "&" : "?";
    navigate(`${targetUrl}${separator}keyword=${encodeURIComponent(tag)}`);
  };

  // 2. KHI CLICK VÀO ẢNH BANNER HOẶC TIÊU ĐỀ
  const handleBannerClick = (url: string) => {
    if (url) navigate(url);
  };

  return (
    <section
      className={`hb-container direct-${currentIndex % 2 === 0 ? "lr" : "rl"}`}
    >
      <div
        className="hb-slider-window"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`hb-slide 
              ${slide.layout === "right" ? "hb-reversed" : ""} 
              ${idx === currentIndex ? "active" : ""} 
              ${idx < currentIndex ? "prev" : ""}
            `}
          >
            {/* Cột Media */}
            <div
              className="hb-media-section"
              onClick={() => handleBannerClick(slide.targetUrl)}
              style={{ cursor: "pointer" }}
            >
              {slide.mediaType === "video" ? (
                <video
                  src={slide.mediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="hb-media-element"
                />
              ) : (
                <SmartImage
                  src={slide.mediaUrl}
                  alt={slide.title}
                  className="hb-media-element"
                  loading="eager"
                />
              )}

              {/* ĐÃ SỬA: Bỏ chặn click ở overlay để ấn vào ảnh có tác dụng */}
              <div className="hb-media-overlay">
                {/* CHỈ chặn click tại vị trí các dấu chấm tròn chuyển slide */}
                <div
                  className="hb-pagination"
                  onClick={(e) => e.stopPropagation()}
                >
                  {slides.map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className={`hb-dot ${dotIdx === currentIndex ? "active" : ""}`}
                      onClick={() => goToSlide(dotIdx)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Cột Content */}
            <div className="hb-content-section">
              <div className="hb-content-wrapper">
                <h1
                  className="hb-title"
                  onClick={() => handleBannerClick(slide.targetUrl)}
                  style={{ cursor: "pointer" }}
                >
                  {slide.title}
                </h1>
                <p className="hb-subtitle">{slide.subtitle}</p>

                <div className="hb-tags-group">
                  {slide.tags.map((tag, tagIdx) => (
                    <button
                      key={tagIdx}
                      className="hb-tag-btn"
                      onClick={(e) => handleTagClick(tag, slide.targetUrl, e)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
