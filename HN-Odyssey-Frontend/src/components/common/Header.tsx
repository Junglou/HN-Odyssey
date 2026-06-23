import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { InstantSearch, useSearchBox } from "react-instantsearch";
import { useHeader } from "../../hooks/common/useHeader";
import { useCart } from "../../hooks/common/cartDrop/useCart";
import { useClickOutside } from "../../hooks/common/useClickOutside";
import CartDropdown from "./cartDrop/CartDropdown";
import SearchDropdown from "./searchDrop/SearchDropdown";
import { searchClient, ALGOLIA_INDEX_NAME } from "../../utils/algoliaClient";
import logoImage from "../../assets/images/logo.png";
import {
  HeartIcon,
  UserIcon,
  CartIcon,
  SearchIconSmall,
} from "../../assets/icons/HeaderIcons";
import "./Header.css";

// component ảo đồng bộ giá trị input với engine của algolia
function VirtualSearchBox({ currentQuery }: { currentQuery: string }) {
  const { refine } = useSearchBox();

  useEffect(() => {
    refine(currentQuery);
  }, [currentQuery, refine]);

  return null;
}

export default function Header() {
  const {
    isVisible,
    isSearchOpen,
    isMobileMenuOpen,
    hasWishlistItems,
    searchQuery,
    searchInputRef,
    setSearchQuery,
    handleOpenSearch,
    forceCloseSearch,
    toggleMobileMenu,
    closeMobileMenu,
    handleSearchKeyDown,
    handleAccountClick,
    handleWishlistClick,
  } = useHeader();

  const {
    isOpen: isCartOpen,
    items: cartItems,
    subtotal,
    isDeleteModalOpen,
    toggleCart,
    closeCart,
    increaseQuantity,
    decreaseQuantity,
    closeDeleteModal,
    confirmDelete,
    handleProceedToCheckout,
  } = useCart();

  const cartWrapperRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const isModalOpenRef = useRef(isDeleteModalOpen);

  // tính tổng số lượng sản phẩm thực tế trong giỏ hàng
  const totalCartQuantity = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  // cập nhật ref theo state modal xóa để tránh lỗi click outside
  useEffect(() => {
    isModalOpenRef.current = isDeleteModalOpen;
  }, [isDeleteModalOpen]);

  // đóng giỏ hàng khi click ra ngoài
  useClickOutside(cartWrapperRef, () => {
    if (isCartOpen && !isModalOpenRef.current) {
      closeCart();
    }
  });

  // đóng popup tìm kiếm khi click ra ngoài
  useClickOutside(searchWrapperRef, () => {
    if (isSearchOpen) {
      forceCloseSearch();
    }
  });

  return (
    <div className={`hn-header-wrapper ${isVisible ? "visible" : "hidden"}`}>
      {/* màng phủ mờ nền khi mở menu di động */}
      <div
        className={`mobile-menu-overlay ${isMobileMenuOpen ? "open" : ""}`}
        onClick={closeMobileMenu}
      />

      {/* thanh chính */}
      <div className="header-main-bar">
        {/* khối bên trái */}
        <div className="header-left">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
          >
            <span className={`bar ${isMobileMenuOpen ? "open" : ""}`}></span>
            <span className={`bar ${isMobileMenuOpen ? "open" : ""}`}></span>
            <span className={`bar ${isMobileMenuOpen ? "open" : ""}`}></span>
          </button>

          <Link to="/" className="header-logo" onClick={closeMobileMenu}>
            <img src={logoImage} alt="H&N Odyssey" />
          </Link>
        </div>

        {/* khối giữa */}
        <nav className="header-nav">
          <Link to="/products?category=featured" className="nav-link">
            Featured
          </Link>
          <Link to="/products?category=men" className="nav-link">
            Men
          </Link>
          <Link to="/products?category=women" className="nav-link">
            Women
          </Link>
          <Link to="/products?category=kid" className="nav-link">
            Kid
          </Link>
          <Link to="/products?category=equipment" className="nav-link">
            Equipment
          </Link>
          <Link to="/products?category=emergency-packs" className="nav-link">
            Emergency Packs
          </Link>
        </nav>

        {/* khối bên phải */}
        <div className="header-actions">
          <div className="header-action-wrapper" onClick={handleWishlistClick}>
            <HeartIcon className="action-icon" />
            {hasWishlistItems && <span className="action-dot"></span>}
          </div>

          <div className="header-action-wrapper" onClick={handleAccountClick}>
            <UserIcon className="action-icon" />
          </div>

          <div className="header-action-wrapper" ref={cartWrapperRef}>
            <div className="cart-trigger-box" onClick={toggleCart}>
              <CartIcon className="action-icon" />
              {/* hiển thị tổng số lượng thay vì độ dài mảng */}
              {totalCartQuantity > 0 && (
                <span className="action-badge">{totalCartQuantity}</span>
              )}
            </div>

            <CartDropdown
              isOpen={isCartOpen}
              items={cartItems}
              subtotal={subtotal}
              isDeleteModalOpen={isDeleteModalOpen}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onCloseDeleteModal={closeDeleteModal}
              onConfirmDelete={confirmDelete}
              onCloseCart={closeCart}
              onProceedToCheckout={handleProceedToCheckout}
            />
          </div>

          {/* bọc algolia tại đây */}
          <InstantSearch
            searchClient={searchClient}
            indexName={ALGOLIA_INDEX_NAME}
          >
            <VirtualSearchBox currentQuery={searchQuery} />

            <div
              className={`header-search ${isSearchOpen ? "active" : ""}`}
              onClick={handleOpenSearch}
              ref={searchWrapperRef}
              style={{ position: "relative" }}
            >
              <SearchIconSmall />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />

              <SearchDropdown
                isOpen={isSearchOpen}
                searchQuery={searchQuery}
                onClose={() => {
                  forceCloseSearch();
                  setSearchQuery("");
                }}
              />
            </div>
          </InstantSearch>
        </div>
      </div>

      {/* thanh trượt dọc menu di động */}
      <div className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}>
        <nav className="mobile-nav">
          <Link
            to="/products?category=featured"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Featured
          </Link>
          <Link
            to="/products?category=men"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Men
          </Link>
          <Link
            to="/products?category=women"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Women
          </Link>
          <Link
            to="/products?category=kid"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Kid
          </Link>
          <Link
            to="/products?category=equipment"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Equipment
          </Link>
          <Link
            to="/products?category=emergency-packs"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Emergency Packs
          </Link>
        </nav>
      </div>
    </div>
  );
}
