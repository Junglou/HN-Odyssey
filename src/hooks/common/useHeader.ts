import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

export function useHeader() {
  const navigate = useNavigate();

  // states
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // mock data states
  const [isAuthenticated] = useState(true);
  const [hasWishlistItems] = useState(true);

  // refs
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // effect scroll ẩn hiện header
  useEffect(() => {
    const handleScroll = () => {
      // chặn ẩn header nếu đang mở menu trên mobile
      if (isMobileMenuOpen) return;

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
  }, [isMobileMenuOpen]);

  // effect khóa màn hình không cho cuộn khi mở menu mobile
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // handlers thao tác UI
  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleCloseSearch = () => {
    if (!searchQuery) {
      setIsSearchOpen(false);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // xử lý điều hướng khi nhấn enter tìm kiếm
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
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
    searchQuery,
    searchInputRef,
    setSearchQuery,
    handleOpenSearch,
    handleCloseSearch,
    toggleMobileMenu,
    closeMobileMenu,
    handleSearchKeyDown,
    handleAccountClick,
    handleWishlistClick,
  };
}
