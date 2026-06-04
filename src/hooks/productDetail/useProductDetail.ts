import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { recordRecentViewProduct } from "../profile/useRecentViewManagement";

// --- HÀM XỬ LÝ ẢNH CHUẨN HOÁ TỪ BACKEND ---
const getFullImageUrl = (url?: string): string => {
  if (!url) return "/Logo.png";
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const serverRootUrl = baseUrl.replace(/\/api.*$/, "").replace(/\/$/, "");
  const formattedUrl = url.startsWith("/") ? url : `/${url}`;
  return `${serverRootUrl}${formattedUrl}`;
};

// --- TYPES TƯƠNG THÍCH BACKEND ---
export interface FormattedOptionValue {
  value: string;
  label: string;
  hex?: string;
}

export interface FormattedOption {
  code: string;
  label: string;
  isColor: boolean;
  values: FormattedOptionValue[];
}

export interface ProductDetailState {
  id: string;
  sku: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
  desc: string;
  details: string;
  hasVariants: boolean;
  options: FormattedOption[];
  images: string[]; // Mảng chứa TẤT CẢ ảnh (Gốc + Biến thể)
}

interface BeSpec {
  name: string;
  values: string[];
}

interface BeAttribute {
  code: string;
  value: string;
  meta?: string;
}

interface BeVariant {
  sku: string;
  price: number;
  sale_price: number;
  stock: number;
  image?: string;
  active: boolean;
  attributes: BeAttribute[];
}

interface BeGallery {
  url: string;
  color?: string;
  display_order: number;
}

interface BeProduct {
  _id: string;
  sku: string;
  name: string;
  price: number;
  sale_price: number;
  stock: number;
  short_description?: string;
  description?: string;
  thumbnail: string;
  has_variants?: boolean;
  specs?: BeSpec[];
  attributes?: BeAttribute[];
  variants?: BeVariant[];
  gallery?: BeGallery[];
  images?: string[];
}

interface DbAttributeValue {
  label: string;
  value: string;
  meta?: string;
}

interface DbAttribute {
  name: string;
  code: string;
  display_type: string;
  values: DbAttributeValue[];
}
// -------------

export function useProductDetail() {
  const { slug } = useParams<{ slug: string }>();

  const [product, setProduct] = useState<ProductDetailState | null>(null);
  const [rawBeProduct, setRawBeProduct] = useState<BeProduct | null>(null);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rawQuantity, setRawQuantity] = useState<number | string>(1);

  // 1. FETCH DỮ LIỆU TẬN GỐC RỄ
  useEffect(() => {
    const fetchProductDetail = async () => {
      try {
        if (!slug) return;

        const [productRes, attrRes] = await Promise.all([
          axiosClient.get(`/products/store/details/${slug}`),
          axiosClient.get(`/attributes`).catch(() => ({ data: [] })),
        ]);

        const beData: BeProduct = productRes.data;
        const allDbAttributes: DbAttribute[] = attrRes.data || [];
        setRawBeProduct(beData);

        const optionsMap = new Map<
          string,
          { label: string; values: Set<string>; isColor: boolean }
        >();

        const addOption = (code: string, value: string) => {
          const lowerCode = code.trim().toLowerCase();
          if (!optionsMap.has(lowerCode)) {
            const dbAttr = allDbAttributes.find(
              (a) => a.code.trim().toLowerCase() === lowerCode,
            );

            optionsMap.set(lowerCode, {
              label: dbAttr
                ? dbAttr.name
                : code.charAt(0).toUpperCase() + code.slice(1).toLowerCase(),
              values: new Set(),
              isColor:
                dbAttr?.display_type === "COLOR_SWATCH" ||
                lowerCode.includes("color") ||
                lowerCode.includes("màu"),
            });
          }
          optionsMap.get(lowerCode)!.values.add(value);
        };

        if (beData.specs) {
          beData.specs.forEach((s) =>
            s.values.forEach((v) => addOption(s.name, v)),
          );
        }
        if (beData.attributes) {
          beData.attributes.forEach((a) => addOption(a.code, a.value));
        }
        if (beData.has_variants && beData.variants) {
          beData.variants.forEach((v) =>
            v.attributes.forEach((a) => addOption(a.code, a.value)),
          );
        }

        const builtOptions: FormattedOption[] = [];
        optionsMap.forEach((data, code) => {
          const dbAttr = allDbAttributes.find(
            (a) => a.code.trim().toLowerCase() === code,
          );

          builtOptions.push({
            code,
            label: data.label,
            isColor: data.isColor,
            values: Array.from(data.values).map((v) => {
              const safeV = v.trim().toLowerCase();
              const dbVal = dbAttr?.values?.find(
                (val) => val.value.trim().toLowerCase() === safeV,
              );
              const fallbackLabel =
                v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

              return {
                value: v,
                label: dbVal ? dbVal.label : fallbackLabel,
                hex: data.isColor ? dbVal?.meta || v : undefined,
              };
            }),
          });
        });

        // TỰ ĐỘNG GOM TẤT CẢ ẢNH VÀO MỘT THƯ VIỆN CHUNG
        const uiImages: string[] = [];

        // Bước A: Lấy ảnh của sản phẩm gốc
        if (beData.gallery?.length) {
          beData.gallery
            .sort((a, b) => a.display_order - b.display_order)
            .forEach((g) => {
              const url = getFullImageUrl(g.url);
              if (!uiImages.includes(url)) uiImages.push(url);
            });
        } else if (beData.images?.length) {
          beData.images.forEach((img) => {
            const url = getFullImageUrl(img);
            if (!uiImages.includes(url)) uiImages.push(url);
          });
        } else {
          uiImages.push(getFullImageUrl(beData.thumbnail));
        }

        // Bước B: Lấy tất cả ảnh của Biến thể chèn nối tiếp vào
        if (beData.has_variants && beData.variants) {
          beData.variants.forEach((v) => {
            if (v.image) {
              const vUrl = getFullImageUrl(v.image);
              if (!uiImages.includes(vUrl)) {
                uiImages.push(vUrl);
              }
            }
          });
        }

        const bePrice = beData.price || 0;
        const beSalePrice = beData.sale_price || 0;

        const formattedProduct: ProductDetailState = {
          id: beData._id,
          sku: beData.sku,
          name: beData.name,
          price: beSalePrice > 0 ? beSalePrice : bePrice,
          originalPrice:
            beSalePrice > 0 && beSalePrice < bePrice ? bePrice : undefined,
          stock: beData.stock,
          desc:
            beData.short_description ||
            beData.description?.replace(/<[^>]+>/g, "").substring(0, 150) ||
            "",
          details: beData.description || "",
          hasVariants: beData.has_variants || false,
          options: builtOptions,
          images: uiImages,
        };

        setProduct(formattedProduct);

        recordRecentViewProduct({
          id: beData._id,
          name: beData.name,
          description: formattedProduct.desc,
          price: formattedProduct.price,
          image: uiImages[0] || "",
        });

        // TÌM BIẾN THỂ CÓ ẢNH TRÙNG VỚI ẢNH THUMBNAIL CỦA SẢN PHẨM MẸ
        let defaultVariant = null;
        if (beData.has_variants && beData.variants && beData.thumbnail) {
          defaultVariant = beData.variants.find(
            (v) =>
              v.image &&
              getFullImageUrl(v.image) === getFullImageUrl(beData.thumbnail),
          );
        }

        const initialSelections: Record<string, string> = {};
        builtOptions.forEach((opt) => {
          if (opt.values.length > 0) {
            if (defaultVariant) {
              // Nếu tìm thấy variant khớp ảnh, lấy giá trị của variant đó gán làm mặc định
              const matchedAttr = defaultVariant.attributes.find(
                (a) => a.code.toLowerCase() === opt.code.toLowerCase(),
              );
              initialSelections[opt.code] = matchedAttr
                ? matchedAttr.value
                : opt.values[0].value;
            } else {
              // Fallback: Nếu không có hoặc lỗi, cứ lấy phần tử đầu tiên
              initialSelections[opt.code] = opt.values[0].value;
            }
          }
        });

        setSelectedOptions(initialSelections);

        if (
          beData.has_variants &&
          beData.variants &&
          beData.variants.length > 0
        ) {
          const matchedVariant = beData.variants.find((v) => {
            return v.attributes.every(
              (attr) =>
                initialSelections[attr.code.toLowerCase()] === attr.value,
            );
          });

          if (matchedVariant && matchedVariant.image) {
            const vUrl = getFullImageUrl(matchedVariant.image);
            const index = uiImages.indexOf(vUrl);
            setActiveImageIndex(index !== -1 ? index : 0);
          }
        }
      } catch (error) {
        console.error("🔥 [LỖI API CHI TIẾT SP]:", error);
      }
    };
    fetchProductDetail();
  }, [slug]);

  // 2. TỰ ĐỘNG TÍNH TOÁN KHI ĐỔI BIẾN THỂ (Memo)
  const derivedProduct = useMemo(() => {
    if (!product) return null;

    let finalPrice = product.price;
    let finalOriginalPrice = product.originalPrice;
    let finalStock = product.stock;
    let finalSku = product.sku;

    if (
      product.hasVariants &&
      rawBeProduct?.variants &&
      rawBeProduct.variants.length > 0
    ) {
      const matchedVariant = rawBeProduct.variants.find((v) => {
        return v.attributes.every(
          (attr) => selectedOptions[attr.code.toLowerCase()] === attr.value,
        );
      });

      if (matchedVariant) {
        finalPrice = matchedVariant.sale_price || matchedVariant.price;
        finalOriginalPrice =
          matchedVariant.sale_price > 0 &&
          matchedVariant.sale_price < matchedVariant.price
            ? matchedVariant.price
            : undefined;
        finalStock = matchedVariant.active === false ? 0 : matchedVariant.stock;
        finalSku = matchedVariant.sku || product.sku;
      } else {
        // Khách chọn 1 tổ hợp không tồn tại trong DB, phải ép Stock về 0
        finalStock = 0;
        finalSku = ""; // Có thể reset SKU để chắc chắn không add to cart nhầm
      }
    }

    return {
      ...product,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      stock: finalStock,
      sku: finalSku,
    };
  }, [product, rawBeProduct, selectedOptions]);

  const quantity = useMemo(() => {
    if (rawQuantity === "") return "";
    const q =
      typeof rawQuantity === "number"
        ? rawQuantity
        : parseInt(rawQuantity as string, 10);
    if (isNaN(q) || q < 1) return 1;

    const maxStock = derivedProduct?.stock || 1;
    if (maxStock === 0) return 1;
    if (q > maxStock) return maxStock;
    return q;
  }, [rawQuantity, derivedProduct?.stock]);

  // --- HANDLERS ---
  const handleOptionChange = (code: string, value: string) => {
    const nextOptions = { ...selectedOptions, [code]: value };
    setSelectedOptions(nextOptions);

    // GIẢI QUYẾT LỖI ESLINT: Tự dò tìm biến thể tương ứng và chuyển slide ảnh ngay trong lúc click
    if (
      product?.hasVariants &&
      rawBeProduct?.variants &&
      rawBeProduct.variants.length > 0
    ) {
      const matchedVariant = rawBeProduct.variants.find((v) => {
        return v.attributes.every(
          (attr) => nextOptions[attr.code.toLowerCase()] === attr.value,
        );
      });

      if (matchedVariant && matchedVariant.image) {
        const vUrl = getFullImageUrl(matchedVariant.image);
        const index = product.images.indexOf(vUrl);
        if (index !== -1) {
          setActiveImageIndex(index);
        } else {
          setActiveImageIndex(0);
        }
      } else {
        setActiveImageIndex(0);
      }
    } else {
      setActiveImageIndex(0);
    }
  };

  const handleImageChange = (index: number) => setActiveImageIndex(index);

  const handleQuantityChange = (type: "inc" | "dec") => {
    const current = typeof quantity === "number" ? quantity : 1;
    const maxStock = derivedProduct?.stock || 1;
    let next = current;

    if (type === "dec" && current > 1) next = current - 1;
    if (type === "inc" && current < maxStock) next = current + 1;
    setRawQuantity(next);
  };

  const handleQuantityInput = (value: string) => {
    if (value === "") return setRawQuantity("");
    const num = parseInt(value, 10);
    if (!isNaN(num)) setRawQuantity(num);
  };

  const handleQuantityBlur = () => setRawQuantity(quantity || 1);

  return {
    product: derivedProduct as ProductDetailState,
    selectedOptions,
    activeImageIndex,
    quantity,
    handleOptionChange,
    handleImageChange,
    handleQuantityChange,
    handleQuantityInput,
    handleQuantityBlur,
  };
}
