import { useState, useEffect, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

export type Gender = "men" | "women";
export type ItemCategory = "top" | "bottom" | "footwear" | "accessory";

export interface ShowcaseProduct {
  id: string;
  name: string;
  gender: Gender;
  category: ItemCategory;
  imageUrl: string;
}

type BEBannerItem = {
  _id: string;
  title: string;
  link: string; // Admin sẽ nhập "men_top", "women_bottom"... vào trường Link
  image_pc: string;
};

const getFullImageUrl = (url?: string): string => {
  if (!url)
    return "https://placehold.co/470x450/f3f4f6/9ca3af?text=Out+of+Stock";
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  )
    return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const serverRootUrl = baseUrl.replace(/\/api.*$/, "").replace(/\/$/, "");
  return `${serverRootUrl}${url.startsWith("/") ? url : `/${url}`}`;
};

export function useCategoryShowcase() {
  const [activeGender, setActiveGender] = useState<Gender>("men");
  const [dbShowcaseItems, setDbShowcaseItems] = useState<ShowcaseProduct[]>([]);

  useEffect(() => {
    const fetchShowcaseBanners = async () => {
      try {
        const res = await axiosClient.get<{ data: BEBannerItem[] }>(
          "/marketing/content/banners/public/active",
          {
            params: { position: "category_showcase" },
          },
        );

        const banners = res.data?.data || [];
        const mappedItems: ShowcaseProduct[] = banners.map((b) => {
          // Parse slot name từ Link (Ví dụ: "men_top" -> gender="men", category="top")
          const [parsedGender, parsedCategory] = (b.link || "men_top").split(
            "_",
          );

          return {
            id: b._id,
            name: b.title || "Showcase Item",
            gender: (parsedGender as Gender) || "men",
            category: (parsedCategory as ItemCategory) || "top",
            imageUrl: getFullImageUrl(b.image_pc),
          };
        });

        setDbShowcaseItems(mappedItems);
      } catch (error) {
        console.error("Failed to load Category Showcase:", error);
      }
    };

    fetchShowcaseBanners();
  }, []);

  const handleSwitchGender = (gender: Gender) => {
    setActiveGender(gender);
  };

  const showcaseItems = useMemo(() => {
    const slots: ItemCategory[] = ["top", "bottom", "footwear", "accessory"];

    return slots.map((slot) => {
      const dbItem = dbShowcaseItems.find(
        (p) => p.gender === activeGender && p.category === slot,
      );

      return (
        dbItem || {
          id: `fallback-${activeGender}-${slot}`,
          name: `Default ${slot}`,
          gender: activeGender,
          category: slot,
          imageUrl: `https://placehold.co/470x450/f3f4f6/9ca3af?text=Slot+Empty`,
        }
      );
    });
  }, [activeGender, dbShowcaseItems]);

  return {
    activeGender,
    handleSwitchGender,
    showcaseItems,
  };
}
