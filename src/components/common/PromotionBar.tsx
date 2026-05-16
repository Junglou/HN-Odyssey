import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  ArrowDownCircleIcon,
  LocationIcon,
} from "../../assets/icons/HeaderIcons";
import "./PromotionBar.css";

// container
const PromotionBar = () => {
  // hook
  const { t, i18n } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);

  // state
  const [isVisible, setIsVisible] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY <= 10) {
        setIsVisible(true);
      } else if (window.scrollY > 50) {
        setIsVisible(false);
        setActiveMenu(null);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // handler
  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setActiveMenu(null);
  };

  // render
  return (
    <div
      ref={barRef}
      className={`promotion-bar-wrapper ${isVisible ? "visible" : "hidden"}`}
    >
      {/* left */}
      <div className="promo-left">
        <div className="promo-item-wrapper">
          <div className="promo-item" onClick={() => toggleMenu("featured")}>
            {t("featured_activities")}{" "}
            <ChevronDownIcon
              className={activeMenu === "featured" ? "rotate" : ""}
            />
          </div>
          <div
            className={`promo-dropdown ${activeMenu === "featured" ? "open" : ""}`}
          >
            <Link to="/blog-news" onClick={() => setActiveMenu(null)}>
              {t("blog_news")}
            </Link>
            <Link to="/loyalty" onClick={() => setActiveMenu(null)}>
              {t("loyalty_rewards")}
            </Link>
          </div>
        </div>

        <div className="promo-item-wrapper">
          <div className="promo-item" onClick={() => toggleMenu("odysseys")}>
            {t("odysseys")}{" "}
            <ChevronDownIcon
              className={activeMenu === "odysseys" ? "rotate" : ""}
            />
          </div>
          {/* Thêm dropdown-center */}
          <div
            className={`promo-dropdown dropdown-center ${activeMenu === "odysseys" ? "open" : ""}`}
          >
            <Link to="/odysseys" onClick={() => setActiveMenu(null)}>
              {t("explore_odysseys")}
            </Link>
          </div>
        </div>

        <div className="promo-item-wrapper">
          <div className="promo-item" onClick={() => toggleMenu("charm")}>
            {t("second_charm")}{" "}
            <ChevronDownIcon
              className={activeMenu === "charm" ? "rotate" : ""}
            />
          </div>
          {/* Thêm dropdown-center */}
          <div
            className={`promo-dropdown dropdown-center ${activeMenu === "charm" ? "open" : ""}`}
          >
            <Link to="/second-charm-form" onClick={() => setActiveMenu(null)}>
              {t("go_to_form")}
            </Link>
          </div>
        </div>
      </div>

      {/* center */}
      <div className="promo-center-container">
        <div className="promo-center" onClick={() => toggleMenu("shipping")}>
          {t("free_shipping")}{" "}
          <ArrowDownCircleIcon
            className={activeMenu === "shipping" ? "rotate" : ""}
          />
        </div>
        <div
          className={`promo-shipping-box ${activeMenu === "shipping" ? "open" : ""}`}
        >
          <div className="ps-content-wrapper">
            <h4 className="ps-title">{t("shipping_info_title")}</h4>
            <p className="ps-text">{t("shipping_info_body1")}</p>
            <p className="ps-text">{t("shipping_info_body2")}</p>
            <div className="ps-partners">
              <span>{t("shipping_partners")}</span>
              <strong>DHL / FedEx / Giao Hàng Nhanh</strong>
            </div>
          </div>
        </div>
      </div>

      {/* right */}
      <div className="promo-right">
        <div className="promo-item-wrapper">
          <div className="promo-item" onClick={() => toggleMenu("lang")}>
            {i18n.language === "vi" ? "Tiếng Việt" : "English"}{" "}
            <ChevronDownIcon
              className={activeMenu === "lang" ? "rotate" : ""}
            />
          </div>
          {/* Thêm dropdown-right */}
          <div
            className={`promo-dropdown dropdown-right ${activeMenu === "lang" ? "open" : ""}`}
          >
            <span onClick={() => changeLanguage("en")}>English</span>
            <span onClick={() => changeLanguage("vi")}>Tiếng Việt</span>
          </div>
        </div>

        <Link to="/find-us" className="promo-item direct-link">
          {t("come_find_us")} <LocationIcon />
        </Link>
      </div>
    </div>
  );
};

export default PromotionBar;
