import { useState, useMemo } from "react";

export interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
}

const MOCK_CART_ITEMS: CartItem[] = [
  {
    id: "1",
    name: "Vital 1",
    description: "Basic wound care and essential first aid treatment.",
    price: 35.99,
    quantity: 1,
    image: "https://placehold.co/150x150/png?text=Vital+1",
  },
  {
    id: "2",
    name: "Ration 1",
    description: "Instant energy supply with no cooking required.",
    price: 5.99,
    quantity: 2,
    image: "https://placehold.co/150x150/png?text=Ration+1",
  },
  {
    id: "3",
    name: "Solo kit 1",
    description: "a knife, fire starter, paracord, and multi-gear.",
    price: 15.99,
    quantity: 1,
    image: "https://placehold.co/150x150/png?text=Solo+kit+1",
  },
  {
    id: "4",
    name: "Vital 2",
    description:
      "Advanced trauma kit for severe medical emergency situations. Includes tactical tourniquet.",
    price: 55.0,
    quantity: 1,
    image: "https://placehold.co/150x150/png?text=Vital+2",
  },
];

export function useCart() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>(MOCK_CART_ITEMS);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const toggleCart = () => setIsOpen((prev) => !prev);
  const closeCart = () => setIsOpen(false);

  // điều khiển đóng mở modal độc lập
  const openDeleteModal = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setItemToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      setItems((prev) => prev.filter((item) => item.id !== itemToDelete));
    }
    closeDeleteModal();
  };

  const increaseQuantity = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const decreaseQuantity = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.quantity === 1) {
            openDeleteModal(id);
            return item;
          }
          return { ...item, quantity: item.quantity - 1 };
        }
        return item;
      }),
    );
  };

  const subtotal = useMemo(() => {
    return items
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
      .toFixed(2);
  }, [items]);

  return {
    isOpen,
    items,
    subtotal,
    isDeleteModalOpen,
    toggleCart,
    closeCart,
    increaseQuantity,
    decreaseQuantity,
    closeDeleteModal,
    confirmDelete,
  };
}
