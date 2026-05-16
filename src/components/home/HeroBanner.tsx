// imports
import { useHeroBannerConfig } from "../../hooks/home/useHeroBannerConfig";
import { AlertCircleIcon } from "../../assets/icons/HomeIcons";
import "./HeroBanner.css";

// container
export default function HeroBanner() {
  const { slides, currentIndex, goToSlide } = useHeroBannerConfig();

  // render
  return (
    // Dynamic class điều khiển hướng kéo của rèm: jic-direct-lr hoặc direct-rl
    <section
      className={`hb-container direct-${currentIndex % 2 === 0 ? "lr" : "rl"}`}
    >
      <div className="hb-slider-window">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`hb-slide 
              ${slide.layout === "right" ? "hb-reversed" : ""} 
              ${idx === currentIndex ? "active" : ""} 
              ${idx < currentIndex ? "prev" : ""}
            `}
          >
            {/* media column */}
            <div className="hb-media-section">
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
                <img
                  src={slide.mediaUrl}
                  alt={slide.title}
                  className="hb-media-element"
                />
              )}

              <div className="hb-media-overlay">
                <div className="hb-icon-wrapper">
                  <AlertCircleIcon width={20} height={20} />
                </div>

                <div className="hb-pagination">
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

            {/* content column */}
            <div className="hb-content-section">
              <div className="hb-content-wrapper">
                <h1 className="hb-title">{slide.title}</h1>
                <p className="hb-subtitle">{slide.subtitle}</p>

                <div className="hb-tags-group">
                  {slide.tags.map((tag, tagIdx) => (
                    <button key={tagIdx} className="hb-tag-btn">
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
