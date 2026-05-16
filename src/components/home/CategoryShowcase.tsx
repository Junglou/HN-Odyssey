import { useCategoryShowcase } from "../../hooks/home/useCategoryShowcase";
import "./CategoryShowcase.css";

export default function CategoryShowcase() {
  const { activeGender, handleSwitchGender, showcaseItems } =
    useCategoryShowcase();

  return (
    <section className="cs-section-container">
      {/* Text & Tabs */}
      <div className="cs-text-wrapper">
        <p className="cs-quote">
          “Guided by the pull of open trails and quiet horizons, we embrace a
          journey where every step reflects freedom, resilience, and the
          timeless wonder of the wild.”
        </p>

        <div className="cs-tabs">
          <button
            className={`cs-tab-btn ${activeGender === "men" ? "active" : ""}`}
            onClick={() => handleSwitchGender("men")}
          >
            Men
          </button>
          <button
            className={`cs-tab-btn ${activeGender === "women" ? "active" : ""}`}
            onClick={() => handleSwitchGender("women")}
          >
            Women
          </button>
        </div>
      </div>

      {/* Image Grid - Thêm key để reset animation khi đổi tab */}
      <div className="cs-image-grid" key={activeGender}>
        {showcaseItems.map((item) => (
          <div key={item.id} className="cs-image-slot">
            <img src={item.imageUrl} alt={item.name} className="cs-image" />
            <div className="cs-image-overlay">
              <span>{item.name}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
