import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { recordRecentViewProduct } from "../profile/useRecentViewManagement";

// helper: Xử lý ảnh chuẩn hóa từ Backend
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
  images: string[];
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
  images?: string[]; // handle: Thay thế image thành images theo cấu trúc mới
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

export function useProductDetail() {
  const { slug } = useParams<{ slug: string }>();

  const [product, setProduct] = useState<ProductDetailState | null>(null);
  const [rawBeProduct, setRawBeProduct] = useState<BeProduct | null>(null);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rawQuantity, setRawQuantity] = useState<number | string>(1);

  // handle: Fetch dữ liệu chi tiết
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

        // helper: Gom ảnh của sản phẩm mẹ làm fallback
        const uiImages: string[] = [];

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
        } else if (beData.thumbnail) {
          uiImages.push(getFullImageUrl(beData.thumbnail));
        }

        // helper: Lấy tất cả ảnh của Biến thể chèn nối tiếp vào thư viện
        if (beData.has_variants && beData.variants) {
          beData.variants.forEach((v) => {
            if (v.images && v.images.length > 0) {
              v.images.forEach((img) => {
                const vUrl = getFullImageUrl(img);
                if (!uiImages.includes(vUrl)) {
                  uiImages.push(vUrl);
                }
              });
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

        // helper: Tìm biến thể có ảnh đầu tiên trùng với thumbnail
        let defaultVariant = null;
        if (beData.has_variants && beData.variants && beData.thumbnail) {
          defaultVariant = beData.variants.find(
            (v) =>
              v.images &&
              v.images.length > 0 &&
              getFullImageUrl(v.images[0]) ===
                getFullImageUrl(beData.thumbnail),
          );
        }

        const initialSelections: Record<string, string> = {};
        builtOptions.forEach((opt) => {
          if (opt.values.length > 0) {
            if (defaultVariant) {
              const matchedAttr = defaultVariant.attributes.find(
                (a) => a.code.toLowerCase() === opt.code.toLowerCase(),
              );
              initialSelections[opt.code] = matchedAttr
                ? matchedAttr.value
                : opt.values[0].value;
            } else {
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

          if (
            matchedVariant &&
            matchedVariant.images &&
            matchedVariant.images.length > 0
          ) {
            const vUrl = getFullImageUrl(matchedVariant.images[0]);
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

  // handle: Tính toán động thông số và bộ sưu tập ảnh theo biến thể
  const derivedProduct = useMemo(() => {
    if (!product) return null;

    let finalPrice = product.price;
    let finalOriginalPrice = product.originalPrice;
    let finalStock = product.stock;
    let finalSku = product.sku;
    let filteredImages: string[] = [];

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

      // helper: Lọc nhóm biến thể có chung thuộc tính chính để gom ảnh
      const primaryOptionCode = product.options[0]?.code.toLowerCase();
      const primaryOptionValue = primaryOptionCode
        ? selectedOptions[primaryOptionCode]
        : null;

      const relatedVariants = rawBeProduct.variants.filter((v) => {
        return v.attributes.some(
          (attr) =>
            attr.code.toLowerCase() === primaryOptionCode &&
            attr.value === primaryOptionValue,
        );
      });

      const uniqueImages = new Set<string>();
      relatedVariants.forEach((v) => {
        if (v.images && v.images.length > 0) {
          v.images.forEach((img) => uniqueImages.add(getFullImageUrl(img)));
        }
      });
      filteredImages = Array.from(uniqueImages);

      if (matchedVariant) {
        finalPrice = matchedVariant.sale_price || matchedVariant.price;
        finalOriginalPrice =
          matchedVariant.sale_price > 0 &&
          matchedVariant.sale_price < matchedVariant.price
            ? matchedVariant.price
            : undefined;
        finalStock = matchedVariant.active === false ? 0 : matchedVariant.stock;
        finalSku = matchedVariant.sku || product.sku;

        // helper: Đẩy ảnh đại diện của biến thể khớp chính xác lên index 0
        if (matchedVariant.images && matchedVariant.images.length > 0) {
          const primaryImgUrl = getFullImageUrl(matchedVariant.images[0]);
          filteredImages = [
            primaryImgUrl,
            ...filteredImages.filter((img) => img !== primaryImgUrl),
          ];
        }
      } else {
        finalStock = 0;
        finalSku = "";
      }
    }

    if (filteredImages.length === 0) {
      filteredImages = product.images;
    }

    return {
      ...product,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      stock: finalStock,
      sku: finalSku,
      images: filteredImages,
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

  // handle: Các sự kiện thay đổi
  const handleOptionChange = (code: string, value: string) => {
    const nextOptions = { ...selectedOptions, [code]: value };
    setSelectedOptions(nextOptions);
    setActiveImageIndex(0);
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
