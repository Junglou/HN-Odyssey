import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../api/axiosClient";
import { getGuestSessionId } from "../../../hooks/common/cartDrop/useCart";
import { useTracking, BehaviorAction } from "../../../hooks/common/useTracking";
import type {
  ChatCardOption,
  ChatCardVariant,
  ChatProductCard,
} from "../../../types/chatbot";
import {
  formatUsd,
  formatUsdRange,
  resolveMediaUrl,
  saveChatbotRef,
} from "../../../utils/chatbotCommerce";
import { buildBuyNowCheckoutUrl } from "../../../utils/buyNow";
import "./ChatProductCarousel.css";
import SmartImage from "../SmartImage/SmartImage";

interface ApiError {
  message?: string;
}

// Phân loại có khớp toàn bộ lựa chọn đang chọn không (lựa chọn có thể chưa đủ nhóm)
const variantMatches = (
  variant: ChatCardVariant,
  selection: Record<string, string>,
) =>
  Object.entries(selection).every(([code, value]) =>
    variant.attributes.some((a) => a.code === code && a.value === value),
  );

// Ký hiệu size giữ nguyên in hoa: S, M, L, XL, XXL, 3XL, 42...
const SIZE_PATTERN = /^(x{0,3}s|x{0,3}l|m|\d+x?l?|\d+(\.\d+)?)$/i;

// "OCEAN-BLUE" -> "Ocean Blue", "xl" -> "XL"
const formatValue = (value: string) => {
  const text = value.replace(/[-_]+/g, " ").trim();
  if (SIZE_PATTERN.test(text)) return text.toUpperCase();
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
};

// Nhãn nhóm lựa chọn lấy theo mã thuộc tính -> cả thẻ cũ (snapshot nhãn tiếng Việt) cũng hiện tiếng Anh
const OPTION_LABELS: Record<string, string> = {
  color: "Color",
  colour: "Color",
  size: "Size",
  capacity: "Capacity",
  material: "Material",
  condition: "Condition",
};

const getOptionLabel = (opt: { code: string; label?: string }) =>
  OPTION_LABELS[opt.code.toLowerCase()] ||
  opt.label ||
  opt.code.charAt(0).toUpperCase() + opt.code.slice(1);

// Ưu tiên tên hiển thị từ bảng thuộc tính (VD "100%" -> "Brand new"); thẻ cũ không có thì tự định dạng
const getValueLabel = (opt: ChatCardOption, value: string) =>
  opt.value_labels?.[value] || formatValue(value);

const isProductSoldOut = (product: ChatProductCard) =>
  product.has_variants
    ? product.variants.every((v) => v.stock <= 0)
    : product.stock <= 0;

// THẺ GỌN TRONG CHAT
interface CompactCardProps {
  product: ChatProductCard;
  onOpen: () => void;
}

function CompactCard({ product, onOpen }: CompactCardProps) {
  const soldOut = isProductSoldOut(product);
  const variantPrices = product.variants.map((v) => v.price);
  const minPrice = product.has_variants
    ? Math.min(...variantPrices)
    : product.price;
  const maxPrice = product.has_variants
    ? Math.max(...variantPrices)
    : product.price;

  return (
    <div className="cpc-card">
      <button
        type="button"
        className="cpc-image-btn"
        onClick={onOpen}
        aria-label={`View ${product.name}`}
      >
        <SmartImage
          src={resolveMediaUrl(product.image)}
          alt={product.name}
          className="cpc-image"
        />
        {soldOut && <span className="cpc-badge">Sold out</span>}
      </button>

      <div className="cpc-body">
        <p className="cpc-name" title={product.name}>
          {product.name}
        </p>
        <div className="cpc-price-row">
          <span className="cpc-price">
            {formatUsdRange(minPrice, maxPrice)}
          </span>
          {minPrice === maxPrice && product.original_price > minPrice && (
            <span className="cpc-original">
              {formatUsd(product.original_price)}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cpc-btn cpc-btn--primary"
          onClick={onOpen}
          disabled={soldOut}
        >
          {soldOut ? "Sold out" : "Shop now"}
        </button>
      </div>
    </div>
  );
}

// BẢNG CHỌN PHÂN LOẠI (trượt từ dưới lên, phủ khung chat)
interface ProductSheetProps {
  product: ChatProductCard;
  conversationId?: string;
  onClose: () => void;
  onViewDetail: () => void;
}

function ProductSheet({
  product,
  conversationId,
  onClose,
  onViewDetail,
}: ProductSheetProps) {
  const { trackEvent } = useTracking();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Nhóm nào chỉ có 1 giá trị thì chọn sẵn
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    product.options.forEach((opt) => {
      if (opt.values.length === 1) init[opt.code] = opt.values[0];
    });
    return init;
  });

  // Đóng bằng phím Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Các phân loại còn phù hợp với lựa chọn hiện tại (kể cả khi chưa chọn đủ)
  const candidates = useMemo(
    () =>
      product.has_variants
        ? product.variants.filter((v) => variantMatches(v, selected))
        : [],
    [product, selected],
  );

  const isFullySelected = product.options.every((opt) => selected[opt.code]);
  const matchedVariant =
    product.has_variants && isFullySelected ? (candidates[0] ?? null) : null;

  // Ảnh: đúng phân loại -> phân loại gần đúng đầu tiên có ảnh (VD mới chọn màu) -> ảnh mặc định
  const previewImage = resolveMediaUrl(
    matchedVariant?.image ||
      candidates.find((v) => v.image)?.image ||
      product.image,
  );

  // Giá: đúng phân loại -> giá thấp nhất trong các phân loại còn phù hợp -> giá thẻ
  // Khoảng giá thu hẹp dần theo lựa chọn; chọn đủ -> còn đúng 1 giá
  let minPrice = product.price;
  let maxPrice = product.price;
  let displayOriginal = product.original_price;

  if (matchedVariant) {
    minPrice = matchedVariant.price;
    maxPrice = matchedVariant.price;
    displayOriginal = matchedVariant.original_price;
  } else if (candidates.length > 0) {
    const prices = candidates.map((v) => v.price);
    minPrice = Math.min(...prices);
    maxPrice = Math.max(...prices);
    displayOriginal =
      candidates.find((v) => v.price === minPrice)?.original_price ?? minPrice;
  }

  const displayPrice = minPrice; // Dùng cho tracking khi thêm giỏ

  const displayStock = product.has_variants
    ? (matchedVariant?.stock ?? null)
    : product.stock;
  const soldOut = isProductSoldOut(product);

  // Giá trị còn mua được không, xét cùng các lựa chọn khác đang chọn
  const isValueAvailable = (code: string, value: string) =>
    product.variants.some(
      (v) => v.stock > 0 && variantMatches(v, { ...selected, [code]: value }),
    );

  const pick = (code: string, value: string) => {
    setError("");
    setSelected((prev) => {
      const next = { ...prev };
      if (next[code] === value) delete next[code];
      else next[code] = value;
      return next;
    });
  };

  // Dùng đúng API giỏ hàng của trang chi tiết. Trả về SKU đã thêm (null nếu lỗi)
  const addToCart = async (): Promise<string | null> => {
    const missing = product.options.filter((opt) => !selected[opt.code]);
    if (product.has_variants && missing.length > 0) {
      setError(
        `Please select ${missing.map((m) => getOptionLabel(m).toLowerCase()).join(", ")}`,
      );
      return null;
    }

    const sku = product.has_variants ? matchedVariant?.sku : product.sku;
    const available = product.has_variants
      ? (matchedVariant?.stock ?? 0)
      : product.stock;

    if (!sku) {
      setError("This option isn't available right now");
      return null;
    }
    if (available < product.min_qty) {
      setError("This option is out of stock");
      return null;
    }

    setBusy(true);
    setError("");
    try {
      await axiosClient.post("/cart/add", {
        productId: product.product_id,
        variantSku: sku,
        quantity: product.min_qty,
        guestSessionId: getGuestSessionId(),
      });

      window.dispatchEvent(new Event("cart_updated")); // Cập nhật giỏ trên header

      trackEvent({
        action: BehaviorAction.ADD_TO_CART,
        path: window.location.pathname,
        metadata: {
          product_id: product.product_id,
          variant_id: sku,
          quantity: product.min_qty,
          price: displayPrice,
        },
      });

      return sku;
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.message || "Couldn't add to cart. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleAddToCart = async () => {
    const sku = await addToCart();
    if (!sku) return;
    toast.success("Added to cart!");
    onClose();
  };

  const handleBuyNow = async () => {
    const sku = await addToCart();
    if (!sku) return;
    // Chỉ "Mua ngay" mới được ghi nhận là đơn từ chatbot
    if (conversationId) {
      saveChatbotRef({ conversationId, productId: product.product_id, sku });
    }
    window.location.href = buildBuyNowCheckoutUrl({
      productId: product.product_id,
      sku,
    });
  };

  return (
    <div className="cps-overlay" onClick={onClose}>
      <div
        className="cps-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cps-header">
          <span className="cps-handle" aria-hidden="true" />
          <button
            type="button"
            className="cps-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="cps-scroll">
          <div className="cps-image-wrap">
            {/* key đổi theo ảnh -> chạy lại hiệu ứng mờ dần khi đổi phân loại */}
            <img
              key={previewImage}
              src={previewImage}
              alt={product.name}
              className="cps-image"
            />
            {soldOut && <span className="cpc-badge">Sold out</span>}
          </div>

          <div className="cps-info">
            <h4 className="cps-name">{product.name}</h4>

            <div className="cpc-price-row">
              <span className="cps-price">
                {formatUsdRange(minPrice, maxPrice)}
              </span>
              {minPrice === maxPrice && displayOriginal > minPrice && (
                <span className="cpc-original">
                  {formatUsd(displayOriginal)}
                </span>
              )}
            </div>

            {displayStock !== null && displayStock > 0 && displayStock <= 5 && (
              <p className="cps-stock">Only {displayStock} left</p>
            )}

            {product.options.map((opt) => (
              <div key={opt.code} className="cps-option">
                <span className="cps-option-label">
                  {getOptionLabel(opt)}
                  {selected[opt.code] && (
                    <strong>: {getValueLabel(opt, selected[opt.code])}</strong>
                  )}
                </span>
                <div className="cps-chips">
                  {opt.values.map((value) => {
                    const isActive = selected[opt.code] === value;
                    const isAvailable = isValueAvailable(opt.code, value);
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`cps-chip ${isActive ? "active" : ""}`}
                        disabled={!isAvailable && !isActive}
                        onClick={() => pick(opt.code, value)}
                      >
                        {getValueLabel(opt, value)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="cps-detail-link"
              onClick={onViewDetail}
            >
              View product details →
            </button>
          </div>
        </div>

        <div className="cps-footer">
          {error && <p className="cps-error">{error}</p>}
          <div className="cps-actions">
            <button
              type="button"
              className="cpc-btn cpc-btn--ghost"
              disabled={busy || soldOut}
              onClick={handleAddToCart}
            >
              Add to Cart
            </button>
            <button
              type="button"
              className="cpc-btn cpc-btn--primary"
              disabled={busy || soldOut}
              onClick={handleBuyNow}
            >
              {busy ? "Processing..." : "Buy Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// CAROUSEL
interface ChatProductCarouselProps {
  products: ChatProductCard[];
  conversationId?: string;
  onAfterNavigate?: () => void; // Để ChatWidget tự thu gọn trên mobile
}

export default function ChatProductCarousel({
  products,
  conversationId,
  onAfterNavigate,
}: ChatProductCarouselProps) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeProduct = products.find((p) => p.product_id === activeId) ?? null;

  // Chuyển trang nội bộ, không tải lại trang -> lịch sử chat được giữ nguyên
  const goToProduct = (slug: string) => {
    setActiveId(null);
    navigate(`/products/${slug}`);
    onAfterNavigate?.();
  };

  return (
    <>
      <div className="cpc-carousel">
        {products.map((product) => (
          <CompactCard
            key={product.product_id}
            product={product}
            onOpen={() => setActiveId(product.product_id)}
          />
        ))}
      </div>

      {activeProduct && (
        <ProductSheet
          key={activeProduct.product_id}
          product={activeProduct}
          conversationId={conversationId}
          onClose={() => setActiveId(null)}
          onViewDetail={() => goToProduct(activeProduct.slug)}
        />
      )}
    </>
  );
}
