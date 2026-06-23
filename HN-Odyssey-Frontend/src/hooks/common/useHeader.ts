import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import tokenStorage from "../../utils/tokenStorage";
import axiosClient from "../../api/axiosClient";

export function useHeader() {
  const navigate = useNavigate();

  // states
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // real data states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasWishlistItems, setHasWishlistItems] = useState<boolean>(false);

  // refs
  const lastScrollY = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // effect: Kéo dữ liệu Wishlist và check Auth
  useEffect(() => {
    let isMounted = true;

    const fetchWishlistStatus = async () => {
      const token = tokenStorage.getToken();

      if (isMounted) {
        setIsAuthenticated(!!token);
      }

      if (!token) {
        if (isMounted) setHasWishlistItems(false);
        return;
      }

      try {
        const res = await axiosClient.get("/users/wishlist");
        if (isMounted) {
          // Lấy mảng dữ liệu trả về (tương thích cả 2 chuẩn res.data.data hoặc res.data)
          const items = res.data?.data || res.data || [];
          setHasWishlistItems(Array.isArray(items) && items.length > 0);
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra wishlist:", error);
      }
    };

    void fetchWishlistStatus();

    // Lắng nghe sự kiện cập nhật wishlist từ các Component khác
    const handleWishlistUpdate = () => {
      if (isMounted) {
        void fetchWishlistStatus();
      }
    };

    window.addEventListener("wishlist_updated", handleWishlistUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("wishlist_updated", handleWishlistUpdate);
    };
  }, []);

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

  // ép đóng popup tìm kiếm dù có chữ hay không
  const forceCloseSearch = () => {
    setIsSearchOpen(false);
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
      navigate(`/products?keyword=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery(""); // xóa trắng ô search sau khi enter
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
    if (isAuthenticated) {
      navigate("/profile/wishlist");
    } else {
      navigate("/login");
    }
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
    forceCloseSearch,
    toggleMobileMenu,
    closeMobileMenu,
    handleSearchKeyDown,
    handleAccountClick,
    handleWishlistClick,
  };
}
