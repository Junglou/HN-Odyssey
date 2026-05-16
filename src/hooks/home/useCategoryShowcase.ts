import { useState, useMemo } from "react";

// Types
export type Gender = "men" | "women";
export type ItemCategory = "top" | "bottom" | "footwear" | "accessory";

export interface ShowcaseProduct {
  id: string;
  name: string;
  gender: Gender;
  category: ItemCategory;
  imageUrl: string;
}

// Mock data
const MOCK_PRODUCTS: ShowcaseProduct[] = [
  {
    id: "m1",
    name: "Adventure Jacket",
    gender: "men",
    category: "top",
    imageUrl: "https://placehold.co/470x450/e5e7eb/111827?text=Men+Top",
  },
  {
    id: "m2",
    name: "Cargo Pants",
    gender: "men",
    category: "bottom",
    imageUrl: "https://placehold.co/470x450/d1d5db/111827?text=Men+Bottom",
  },
  {
    id: "m3",
    name: "Hiking Boots",
    gender: "men",
    category: "footwear",
    imageUrl: "https://placehold.co/470x450/9ca3af/111827?text=Men+Footwear",
  },
  {
    id: "m4",
    name: "Explorer Backpack",
    gender: "men",
    category: "accessory",
    imageUrl: "https://placehold.co/470x450/6b7280/ffffff?text=Men+Accessory",
  },
  {
    id: "w1",
    name: "Windbreaker Coat",
    gender: "women",
    category: "top",
    imageUrl: "https://placehold.co/470x450/fce7f3/831843?text=Women+Top",
  },
  {
    id: "w2",
    name: "Trekking Leggings",
    gender: "women",
    category: "bottom",
    imageUrl: "https://placehold.co/470x450/fbcfe8/831843?text=Women+Bottom",
  },
  {
    id: "w3",
    name: "Trail Shoes",
    gender: "women",
    category: "footwear",
    imageUrl: "https://placehold.co/470x450/f9a8d4/831843?text=Women+Footwear",
  },
  {
    id: "w4",
    name: "Waist Bag",
    gender: "women",
    category: "accessory",
    imageUrl: "https://placehold.co/470x450/f472b6/ffffff?text=Women+Accessory",
  },
];

export function useCategoryShowcase() {
  const [activeGender, setActiveGender] = useState<Gender>("men");

  const handleSwitchGender = (gender: Gender) => {
    setActiveGender(gender);
  };

  // Assembly logic
  const showcaseItems = useMemo(() => {
    const slots: ItemCategory[] = ["top", "bottom", "footwear", "accessory"];

    return slots.map((slot) => {
      const item = MOCK_PRODUCTS.find(
        (p) => p.gender === activeGender && p.category === slot,
      );

      return (
        item || {
          id: `fallback-${slot}`,
          name: `Default ${slot}`,
          gender: activeGender,
          category: slot,
          imageUrl: `https://placehold.co/470x450/f3f4f6/9ca3af?text=Out+of+Stock`,
        }
      );
    });
  }, [activeGender]);

  return {
    activeGender,
    handleSwitchGender,
    showcaseItems,
  };
}
