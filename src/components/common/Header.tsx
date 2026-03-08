import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Header.css";

import logoImage from "../../assets/images/logo.png";
import {
  HeartIcon,
  UserIcon,
  CartIcon,
  SearchIconSmall,
} from "../../assets/icons/HeaderIcons";

const Header = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const lastScrollY = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 80) {
        setIsVisible(true);
      } else if (currentScrollY < lastScrollY.current - 2) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current + 2) {
        setIsVisible(false);
        setIsSearchOpen(false);
      }

      lastScrollY.current = currentScrollY <= 0 ? 0 : currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className={`hn-header-wrapper ${isVisible ? "visible" : "hidden"}`}>
      <div className="header-main-bar">
        {/* KHỐI 1: BÊN TRÁI (LOGO) */}
        <div className="header-left">
          <Link to="/" className="header-logo">
            <img src={logoImage} alt="H&N Odyssey" />
          </Link>
        </div>

        {/* KHỐI 2: Ở GIỮA (MENU NGANG) */}
        <nav className="header-nav">
          <Link to="/featured" className="nav-link">
            Featured
          </Link>
          <Link to="/men" className="nav-link">
            Men
          </Link>
          <Link to="/women" className="nav-link">
            Women
          </Link>
          <Link to="/kid" className="nav-link">
            Kid
          </Link>
          <Link to="/equipment" className="nav-link">
            Equipment
          </Link>
          <Link to="/emergency" className="nav-link">
            Emergency Packs
          </Link>
        </nav>

        {/* KHỐI 3: BÊN PHẢI (ICONS & SEARCH) */}
        <div className="header-actions">
          <HeartIcon className="action-icon" />
          <UserIcon className="action-icon" />
          <CartIcon className="action-icon" />

          <div
            className={`header-search ${isSearchOpen ? "active" : ""}`}
            onClick={handleOpenSearch}
          >
            <SearchIconSmall />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search"
              onBlur={() => setIsSearchOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
