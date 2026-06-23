// imports
import { useShoppingCart } from "../../hooks/shoppingCart/useShoppingCart";
import CartItemList from "../../components/shoppingCart/CartItemList";
import CartRecommendations from "../../components/shoppingCart/CartRecommendations";
import OrderSummary from "../../components/shoppingCart/OrderSummary";
import "./ShoppingCartPage.css";

// component
export default function ShoppingCartPage() {
  // hook
  const {
    cartItems,
    recommendations,
    subtotal,
    shippingFee,
    taxes,
    total,
    editingItemId,
    handleRemoveItem,
    handleAddRecommendation,
    toggleEdit,
    increaseQuantity,
    decreaseQuantity,
    handleAddToWishlist,
    handleCheckout,
  } = useShoppingCart();

  // render
  return (
    <div className="shopping-cart-page-wrapper">
      <div className="shopping-cart-grid">
        <div className="shopping-cart-left-col">
          <CartItemList
            items={cartItems}
            editingItemId={editingItemId}
            onRemove={handleRemoveItem}
            onToggleEdit={toggleEdit}
            onIncrease={increaseQuantity}
            onDecrease={decreaseQuantity}
            onAddToWishlist={handleAddToWishlist}
          />
        </div>

        <div className="shopping-cart-right-col">
          <CartRecommendations
            items={recommendations}
            onAdd={handleAddRecommendation}
          />
          <div className="sticky-summary-wrapper">
            <OrderSummary
              subtotal={subtotal}
              shippingFee={shippingFee}
              taxes={taxes}
              total={total}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
