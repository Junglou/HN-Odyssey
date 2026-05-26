import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useHeader() {
  const navigate = useNavigate();

  // states
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // mock data states
  const [isAuthenticated] = useState(false);
  const [hasWishlistItems] = useState(true);

  // refs
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // effect scroll ẩn hiện header
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
        setIsMobileMenuOpen(false);
      }

      lastScrollY.current = currentScrollY <= 0 ? 0 : currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // handlers thao tác UI
  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // handlers điều hướng
  const handleAccountClick = () => {
    if (isAuthenticated) {
      navigate("/profile");
    } else {
      navigate("/login");
    }
  };

  const handleWishlistClick = () => {
    navigate("/profile/wishlist");
  };

  return {
    isVisible,
    isSearchOpen,
    isMobileMenuOpen,
    hasWishlistItems,
    searchInputRef,
    handleOpenSearch,
    handleCloseSearch,
    toggleMobileMenu,
    closeMobileMenu,
    handleAccountClick,
    handleWishlistClick,
  };
}
