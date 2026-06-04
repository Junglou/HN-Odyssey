import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";

// 1. FRONTEND UI TYPES

export interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
}

// 2. BACKEND RESPONSE TYPES

interface ValidatedCartItem {
  productId: string;
  variantId?: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  sku: string;
  attributes: Record<string, unknown>[];
  quantity: number;
  stock: number;
  unitPrice: number;
  originalPrice: number;
  subtotal: number;
  maxPurchase: number;
  isError: boolean;
  weight: number;
}

interface CartSummary {
  subtotal: number;
  discount: number;
  shippingFee: number;
  grandTotal: number;
  itemCount: number;
}

interface CartResponse {
  cartId: string;
  items: ValidatedCartItem[];
  summary: CartSummary;
  warnings: string[];
}

interface ApiError {
  status?: number;
  message: string;
  data?: unknown;
}

// 3. UTILITIES

const GUEST_SESSION_KEY = "guestSessionId";

export const getGuestSessionId = (): string => {
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
};

// 4. MAIN HOOK

export function useCart() {
  const navigate = useNavigate();

  // States
  const [items, setItems] = useState<CartItem[]>([]);
  const [summarySubtotal, setSummarySubtotal] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // --- API CALLS & DATA MAPPING ---
  const fetchCart = useCallback(async () => {
    try {
      const guestSessionId = getGuestSessionId();
      const res = await axiosClient.get<CartResponse>(
        `/cart?guestSessionId=${guestSessionId}`,
      );

      const mappedItems: CartItem[] = res.data.items.map((item) => {
        let descriptionText = `SKU: ${item.sku}`;
        if (
          item.attributes &&
          Array.isArray(item.attributes) &&
          item.attributes.length > 0
        ) {
          descriptionText = item.attributes
            .map((attr) => {
              const entries = Object.entries(attr);
              if (entries.length > 0) {
                return `${entries[0][0]}: ${String(entries[0][1])}`;
              }
              return "";
            })
            .filter(Boolean)
            .join(", ");
        }

        return {
          id: `${item.productId}_${item.sku}`,
          name: item.productName,
          description: descriptionText,
          price: item.unitPrice,
          quantity: item.quantity,
          image:
            item.thumbnail || "https://placehold.co/150x150/png?text=No+Image",
        };
      });

      setItems(mappedItems);
      setSummarySubtotal(res.data.summary.subtotal);

      if (res.data.warnings && res.data.warnings.length > 0) {
        res.data.warnings.forEach((warning) => toast.warning(warning));
      }
    } catch (err) {
      const error = err as ApiError;
      console.error("Fetch cart error:", error);
    }
  }, []);

  // --- ACTIONS: UI Controls ---
  const toggleCart = () => {
    setIsOpen((prev) => {
      // Nếu đang đóng và chuẩn bị mở -> Cập nhật data ngay lập tức
      if (!prev) {
        fetchCart();
      }
      return !prev;
    });
  };

  const closeCart = () => setIsOpen(false);

  const openDeleteModal = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setItemToDelete(null);
    setIsDeleteModalOpen(false);
  };

  // Đồng bộ giỏ hàng
  useEffect(() => {
    //eslint-disable-next-line react-hooks/exhaustive-deps
    fetchCart(); // Kéo data lần đầu khi load app

    // Lắng nghe sự kiện để đồng bộ giỏ hàng giữa các Component
    const handleCartUpdate = () => {
      fetchCart();
    };

    window.addEventListener("cart_updated", handleCartUpdate);
    return () => {
      window.removeEventListener("cart_updated", handleCartUpdate);
    };
  }, [fetchCart]);

  // --- ACTIONS: Cart Operations ---
  const increaseQuantity = async (id: string) => {
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return;

    const [productId, sku] = id.split("_");

    try {
      const guestSessionId = getGuestSessionId();
      await axiosClient.patch("/cart/update", {
        productId,
        variantSku: sku,
        quantity: currentItem.quantity + 1,
        guestSessionId,
      });
      // Phát sự kiện để báo cho các giỏ hàng khác cùng update
      window.dispatchEvent(new Event("cart_updated"));
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Không thể tăng số lượng.");
    }
  };

  const decreaseQuantity = async (id: string) => {
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return;

    if (currentItem.quantity === 1) {
      openDeleteModal(id);
      return;
    }

    const [productId, sku] = id.split("_");

    try {
      const guestSessionId = getGuestSessionId();
      await axiosClient.patch("/cart/update", {
        productId,
        variantSku: sku,
        quantity: currentItem.quantity - 1,
        guestSessionId,
      });
      window.dispatchEvent(new Event("cart_updated"));
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Không thể giảm số lượng.");
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      const [productId, sku] = itemToDelete.split("_");

      try {
        const guestSessionId = getGuestSessionId();
        await axiosClient.delete("/cart/remove", {
          data: {
            productId,
            variantSku: sku,
            guestSessionId,
          },
        });
        window.dispatchEvent(new Event("cart_updated"));
        toast.success("Đã xóa sản phẩm khỏi giỏ hàng.");
      } catch (err) {
        const error = err as ApiError;
        toast.error(error.message || "Lỗi khi xóa sản phẩm.");
      }
    }
    closeDeleteModal();
  };

  const handleProceedToCheckout = () => {
    if (items.length === 0) {
      toast.warning("Giỏ hàng của bạn hiện tại đang trống!");
      return;
    }
    closeCart();
    navigate("/checkout");
  };

  const subtotal = useMemo(() => {
    return summarySubtotal.toFixed(2);
  }, [summarySubtotal]);


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
    handleProceedToCheckout,
  };
}
