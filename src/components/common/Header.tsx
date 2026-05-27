// imports
import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useHeader } from "../../hooks/common/useHeader";
import { useCart } from "../../hooks/common/cartDrop/useCart";
import { useClickOutside } from "../../hooks/common/useClickOutside";
import CartDropdown from "./cartDrop/CartDropdown";
import logoImage from "../../assets/images/logo.png";
import {
  HeartIcon,
  UserIcon,
  CartIcon,
  SearchIconSmall,
} from "../../assets/icons/HeaderIcons";
import "./Header.css";

// component
export default function Header() {
  // hooks
  const {
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
  const isModalOpenRef = useRef(isDeleteModalOpen);

  // side effects
  useEffect(() => {
    isModalOpenRef.current = isDeleteModalOpen;
  }, [isDeleteModalOpen]);

  useClickOutside(cartWrapperRef, () => {
    if (isCartOpen && !isModalOpenRef.current) {
      closeCart();
    }
  });

  // render
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
              {cartItems.length > 0 && (
                <span className="action-badge">{cartItems.length}</span>
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

          <div
            className={`header-search ${isSearchOpen ? "active" : ""}`}
            onClick={handleOpenSearch}
          >
            <SearchIconSmall />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={handleCloseSearch}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        </div>
      </div>

      {/* thanh trượt dọc menu di động */}
      <div className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}>
        <nav className="mobile-nav">
          <Link
            to="/featured"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Featured
          </Link>
          <Link to="/men" className="mobile-nav-link" onClick={closeMobileMenu}>
            Men
          </Link>
          <Link
            to="/women"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Women
          </Link>
          <Link to="/kid" className="mobile-nav-link" onClick={closeMobileMenu}>
            Kid
          </Link>
          <Link
            to="/equipment"
            className="mobile-nav-link"
            onClick={closeMobileMenu}
          >
            Equipment
          </Link>
          <Link
            to="/emergency"
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
