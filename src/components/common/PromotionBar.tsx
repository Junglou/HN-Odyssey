import { useState, useEffect } from "react";
import "./PromotionBar.css";
import {
  ChevronDownIcon,
  ArrowDownCircleIcon,
  LocationIcon,
} from "../../assets/icons/HeaderIcons";

const PromotionBar = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY <= 10) {
        setIsVisible(true);
      } else if (window.scrollY > 50) {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`promotion-bar-wrapper ${isVisible ? "visible" : "hidden"}`}
    >
      {/* Khối bên trái */}
      <div className="promo-left">
        <div className="promo-item">
          Featured Activities <ChevronDownIcon />
        </div>
        <div className="promo-item">
          Odysseys <ChevronDownIcon />
        </div>
        <div className="promo-item">
          2nd The Charm <ChevronDownIcon />
        </div>
      </div>

      {/* Khối trung tâm (Căn giữa tuyệt đối) */}
      <div className="promo-center">
        Free Shipping Across The Country <ArrowDownCircleIcon />
      </div>

      {/* Khối bên phải */}
      <div className="promo-right">
        <div className="promo-item">
          English <ChevronDownIcon />
        </div>
        <div className="promo-item">
          Come Find Us <LocationIcon />
        </div>
      </div>
    </div>
  );
};

export default PromotionBar;
