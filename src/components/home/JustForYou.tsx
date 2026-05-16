// imports
import {
  useJustForYouSlider,
  type ConfigElement,
} from "../../hooks/home/useJustForYouSlider";
import "./JustForYou.css";

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
  const topPercent = (el.y / 900) * 100;
  const widthPercent = (el.width / 1920) * 100;
  const heightPercent = (el.height / 900) * 100;

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
    case "button":
      return (
        <button key={el.id} style={baseStyle} className="jfy-dynamic-btn">
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
export default function JustForYou() {
  const { slides, currentIndex, goToSlide } = useJustForYouSlider();

  // render
  return (
    <section className="jfy-container">
      <div className="jfy-text-wrapper">
        <h2 className="jfy-title">Just for you</h2>
        <p className="jfy-subtitle">
          “Created with your story in mind, every choice is a gentle reminder
          that the things you connect with are the ones meant to find you.”
        </p>
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
              style={{ backgroundImage: `url(${slide.backgroundUrl})` }}
            >
              <div className="jfy-canvas-layer">
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
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
