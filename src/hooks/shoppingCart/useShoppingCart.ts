// imports
import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// interface
export interface DetailedCartItem {
  id: string;
  name: string;
  price: number;
  description: string;
  contents: string;
  size: string;
  quantity: number;
  image: string;
}

export interface RecommendItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

// data
const INITIAL_CART_ITEMS: DetailedCartItem[] = [
  {
    id: "1",
    name: "Vital Kit 1",
    price: 35.99,
    description: "Basic wound care and essential first aid treatment.",
    contents: "Bandages, Antiseptic Wipes, Scissors, EpiPen,...",
    size: "Full",
    quantity: 2,
    image: "https://placehold.co/338x190/png?text=Vital+Kit+1",
  },
  {
    id: "2",
    name: "Solo Kit 1",
    price: 15.99,
    description:
      "Core survival tools including a knife, fire starter, paracord, and multi-purpose gear.",
    contents: "Knife, Strengthen-Rope, Fire-Starter,...",
    size: "Full",
    quantity: 1,
    image: "https://placehold.co/338x190/png?text=Solo+Kit+1",
  },
  {
    id: "3",
    name: "Ration 1",
    price: 5.99,
    description: "Instant energy supply with no cooking required.",
    contents: "Freeze-Dried Meal, Energy Bar, Dried-Nuts, ...",
    size: "Full",
    quantity: 2,
    image: "https://placehold.co/338x190/png?text=Ration+1",
  },
];

const RECOMMEND_ITEMS: RecommendItem[] = [
  {
    id: "rec-1",
    name: "Ration 1",
    description: "Instant energy supply with no cooking required.",
    price: 5.99,
    image: "https://placehold.co/198x115/png?text=Ration+1",
  },
  {
    id: "rec-2",
    name: "Solo kit 1",
    description: "a knife, fire starter, paracord, and multi-gear.",
    price: 15.99,
    image: "https://placehold.co/198x115/png?text=Solo+kit+1",
  },
  {
    id: "rec-3",
    name: "Vital 1",
    description: "Basic wound care and essential first aid treatment.",
    price: 35.99,
    image: "https://placehold.co/198x115/png?text=Vital+1",
  },
];

// hook
export function useShoppingCart() {
  // states
  const [cartItems, setCartItems] =
    useState<DetailedCartItem[]>(INITIAL_CART_ITEMS);
  const [recommendations] = useState<RecommendItem[]>(RECOMMEND_ITEMS);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // handlers
  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    toast.info("Đã xóa sản phẩm khỏi giỏ hàng");
  };

  const handleAddRecommendation = (recItem: RecommendItem) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.name === recItem.name);
      if (existing) {
        return prev.map((item) =>
          item.name === recItem.name
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: recItem.id,
          name: recItem.name,
          price: recItem.price,
          description: recItem.description,
          contents: "Standard items package included.",
          size: "Full",
          quantity: 1,
          image: recItem.image,
        },
      ];
    });
    toast.success("Đã thêm sản phẩm gợi ý vào giỏ hàng!");
  };

  const toggleEdit = (id: string) => {
    setEditingItemId((prev) => (prev === id ? null : id));
  };

  const increaseQuantity = (id: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const decreaseQuantity = (id: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item,
      ),
    );
  };

  const handleAddToWishlist = (id: string) => {
    // TODO: Connect API
    console.log(`Add item ${id} to wishlist`);
    toast.success("Thêm vào danh sách yêu thích thành công!");
  };

  const handleCheckout = () => {
    // TODO: Connect API / Validate / Navigate to Checkout Page
    if (cartItems.length === 0) {
      toast.error("Giỏ hàng của bạn đang trống!");
      return;
    }
    toast.info("Đang chuyển hướng đến trang thanh toán...");
    console.log("Process to checkout with items:", cartItems);
  };

  // helpers
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const taxes = useMemo(() => subtotal * 0.05, [subtotal]);
  const shippingFee = 0;
  const total = useMemo(
    () => subtotal + taxes + shippingFee,
    [subtotal, taxes],
  );

  return {
    cartItems,
    recommendations,
    subtotal: subtotal.toFixed(2),
    taxes: taxes.toFixed(2),
    shippingFee: shippingFee === 0 ? "Free" : `${shippingFee}$`,
    total: total.toFixed(2),
    editingItemId,
    handleRemoveItem,
    handleAddRecommendation,
    toggleEdit,
    increaseQuantity,
    decreaseQuantity,
    handleAddToWishlist,
    handleCheckout,
  };
}
