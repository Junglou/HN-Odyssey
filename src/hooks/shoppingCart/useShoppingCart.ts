import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";

export interface DetailedCartItem {
  id: string;
  productId: string;
  variantId?: string;
  isWishlisted: boolean;
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
  productId: string;
  variantId?: string;
  name: string;
  description: string;
  price: number;
  image: string;
  sku: string;
  slug?: string;
}

interface ApiCartItemAttribute {
  k?: string;
  name?: string;
  v?: string;
  value?: string;
}

interface ApiCartItem {
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  unitPrice: number;
  productSlug?: string;
  quantity: number;
  thumbnail: string;
  attributes?: ApiCartItemAttribute[];
}

interface ApiCartSummary {
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  grandTotal?: number;
}

interface ApiCartData {
  items?: ApiCartItem[];
  summary?: ApiCartSummary;
}

interface ApiRecommendation {
  _id?: string;
  productId?: string;
  sku?: string;
  slug?: string;
  has_variants?: boolean;
  name: string;
  description?: string;
  sale_price?: number;
  price: number;
  thumbnail?: string;
  variants?: { _id: string; sku: string; active?: boolean }[];
}

interface RecParams {
  current_cart_total: number;
  exclude_ids: string;
  session_id?: string;
}

interface ApiError {
  message?: string;
}

interface ApiWishlistItem {
  productId: string;
  variantId?: string;
}

const getOrCreateGuestSessionId = (): string => {
  let sessionId = localStorage.getItem("guestSessionId");
  if (!sessionId) {
    sessionId = `guest_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("guestSessionId", sessionId);
  }
  return sessionId;
};

export function useShoppingCart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<DetailedCartItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [cartSummary, setCartSummary] = useState({
    subtotal: 0,
    discount: 0,
    shippingFee: 0,
    grandTotal: 0,
  });

  const fetchCartAndRecommendations = useCallback(async () => {
    try {
      const isLogged = !!tokenStorage.getToken();
      const guestSessionId = isLogged ? undefined : getOrCreateGuestSessionId();

      const wishlistSet = new Set<string>();
      if (isLogged) {
        try {
          const wlRes = await axiosClient.get("/users/wishlist");
          if (wlRes.data?.success && Array.isArray(wlRes.data.data)) {
            wlRes.data.data.forEach((wItem: ApiWishlistItem) => {
              if (wItem.productId) {
                const key = `${wItem.productId}|${wItem.variantId || "null"}`;
                wishlistSet.add(key);
              }
            });
          }
        } catch (e) {
          console.warn("Lỗi fetch wishlist ngầm", e);
        }
      }

      const cartResponse = await axiosClient.get<ApiCartData>("/cart", {
        params: { guestSessionId },
      });

      const cartData = cartResponse.data;

      const mappedItems: DetailedCartItem[] = (cartData.items || []).map(
        (item: ApiCartItem) => {
          const sizeAttr = item.attributes?.find(
            (a: ApiCartItemAttribute) =>
              a.k?.toLowerCase() === "size" || a.name?.toLowerCase() === "size",
          );
          const sizeVal = sizeAttr ? sizeAttr.v || sizeAttr.value : item.sku;

          const checkKey = `${item.productId}|${item.variantId || "null"}`;
          const isWishlisted = wishlistSet.has(checkKey);

          return {
            id: `${item.productId}|${item.sku}`,
            productId: item.productId,
            variantId: item.variantId,
            isWishlisted,
            name: item.productName,
            price: item.unitPrice,
            description: item.productSlug || "",
            contents: item.sku,
            size: sizeVal || "",
            quantity: item.quantity,
            image: item.thumbnail,
          };
        },
      );

      setCartItems(mappedItems);

      const currentSubtotal = cartData.summary?.subtotal || 0;
      setCartSummary({
        subtotal: currentSubtotal,
        discount: cartData.summary?.discount || 0,
        shippingFee: cartData.summary?.shippingFee || 0,
        grandTotal: cartData.summary?.grandTotal || 0,
      });

      const excludeIds = (cartData.items || [])
        .map((i: ApiCartItem) => i.productId)
        .join(",");

      const recParams: RecParams = {
        current_cart_total: currentSubtotal,
        exclude_ids: excludeIds,
      };

      if (!isLogged && guestSessionId) {
        recParams.session_id = guestSessionId;
      }

      const recResponse = await axiosClient.get<ApiRecommendation[]>(
        "/recommendations/cart",
        {
          params: recParams,
        },
      );

      if (recResponse.data && Array.isArray(recResponse.data)) {
        const mappedRecs = recResponse.data.map((r: ApiRecommendation) => {
          let realSku = r.sku || "";
          let realVariantId: string | undefined = undefined;

          if (r.has_variants && r.variants && r.variants.length > 0) {
            const validVariant =
              r.variants.find((v) => v.active) || r.variants[0];
            realSku = validVariant?.sku || realSku;
            realVariantId = validVariant?._id || undefined;
          }

          return {
            id: r._id || r.productId || "",
            productId: r._id || r.productId || "",
            variantId: realVariantId,
            sku: realSku,
            slug: r.slug || "",
            name: r.name,
            description: r.description || "Sản phẩm gợi ý",
            price: r.sale_price && r.sale_price > 0 ? r.sale_price : r.price,
            image:
              r.thumbnail || "https://placehold.co/198x115/png?text=No+Image",
          };
        });
        setRecommendations(mappedRecs);
      }
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Lỗi khi lấy dữ liệu giỏ hàng");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      if (isMounted) {
        await fetchCartAndRecommendations();
      }
    };

    void loadInitialData();

    const handleCartUpdate = () => {
      if (isMounted) {
        void fetchCartAndRecommendations();
      }
    };
    window.addEventListener("cart_updated", handleCartUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("cart_updated", handleCartUpdate);
    };
  }, [fetchCartAndRecommendations]);

  const handleRemoveItem = async (id: string) => {
    const [productId, variantSku] = id.split("|");
    try {
      const isLogged = !!tokenStorage.getToken();
      const guestSessionId = isLogged ? undefined : getOrCreateGuestSessionId();

      await axiosClient.delete("/cart/remove", {
        data: { productId, variantSku, guestSessionId },
      });
      toast.info("Đã xóa sản phẩm khỏi giỏ hàng");

      await fetchCartAndRecommendations();
      window.dispatchEvent(new Event("cart_updated"));
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Lỗi xử lý xóa sản phẩm");
    }
  };

  const handleAddRecommendation = async (recItem: RecommendItem) => {
    try {
      const isLogged = !!tokenStorage.getToken();
      const guestSessionId = isLogged ? undefined : getOrCreateGuestSessionId();

      if (!recItem.sku) {
        toast.error("Sản phẩm này bị thiếu dữ liệu SKU.");
        return;
      }

      await axiosClient.post("/cart/add", {
        productId: recItem.productId,
        variantSku: recItem.sku,
        quantity: 1,
        guestSessionId,
      });
      toast.success("Đã thêm sản phẩm gợi ý vào giỏ hàng!");

      await fetchCartAndRecommendations();
      window.dispatchEvent(new Event("cart_updated"));
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Lỗi khi thêm gợi ý giỏ hàng");
    }
  };

  const toggleEdit = (id: string) => {
    setEditingItemId((prev) => (prev === id ? null : id));
  };

  const updateQuantity = async (id: string, newQuantity: number) => {
    const [productId, variantSku] = id.split("|");
    try {
      const isLogged = !!tokenStorage.getToken();
      const guestSessionId = isLogged ? undefined : getOrCreateGuestSessionId();

      await axiosClient.patch("/cart/update", {
        productId,
        variantSku,
        quantity: newQuantity,
        guestSessionId,
      });

      await fetchCartAndRecommendations();
      window.dispatchEvent(new Event("cart_updated"));
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Số lượng cập nhật không hợp lệ");
    }
  };

  const increaseQuantity = (id: string) => {
    const item = cartItems.find((i) => i.id === id);
    if (item) {
      void updateQuantity(id, item.quantity + 1);
    }
  };

  const decreaseQuantity = (id: string) => {
    const item = cartItems.find((i) => i.id === id);
    if (item && item.quantity > 1) {
      void updateQuantity(id, item.quantity - 1);
    }
  };

  const handleAddToWishlist = async (id: string) => {
    const item = cartItems.find((i) => i.id === id);
    if (!item) return;

    try {
      const isLogged = !!tokenStorage.getToken();
      if (!isLogged) {
        toast.warning("Vui lòng đăng nhập để sử dụng tính năng này!");
        return;
      }

      const res = await axiosClient.post("/users/wishlist/toggle", {
        productId: item.productId,
        variantId: item.variantId || undefined,
      });

      toast.success(res.data.message || "Thao tác thành công!");
      await fetchCartAndRecommendations();
    } catch (error: unknown) {
      const err = error as ApiError;
      toast.error(err?.message || "Lỗi khi cập nhật wishlist");
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Giỏ hàng của bạn đang trống!");
      return;
    }
    navigate("/checkout");
  };

  const subtotalFormatted = cartSummary.subtotal.toFixed(2);
  const taxesFormatted = (cartSummary.subtotal * 0.05).toFixed(2);
  const shippingFeeFormatted =
    cartSummary.shippingFee === 0 ? "Free" : `${cartSummary.shippingFee}$`;
  const totalFormatted =
    cartSummary.grandTotal > 0
      ? cartSummary.grandTotal.toFixed(2)
      : (cartSummary.subtotal + parseFloat(taxesFormatted)).toFixed(2);

  return {
    cartItems,
    recommendations,
    subtotal: subtotalFormatted,
    taxes: taxesFormatted,
    shippingFee: shippingFeeFormatted,
    total: totalFormatted,
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
