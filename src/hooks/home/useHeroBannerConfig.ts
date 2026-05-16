// imports
import { useState, useEffect } from "react";

// types
export interface SlideData {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  mediaUrl: string;
  mediaType: "image" | "video";
  layout: "left" | "right";
}

// mock data
const MOCK_SLIDES: SlideData[] = [
  {
    id: "slide-1",
    title: "Men’s Wear",
    subtitle: "Where Style Meets Adventure.",
    tags: ["Equipment", "Men", "Women", "Emergency Packs"],
    mediaUrl: "https://placehold.co/960x600/e5e7eb/000000?text=Men+Image",
    mediaType: "image",
    layout: "left",
  },
  {
    id: "slide-2",
    title: "Women’s Collection",
    subtitle: "Elegance in Every Step.",
    tags: ["Women", "Apparel", "New Arrivals"],
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    mediaType: "video",
    layout: "right",
  },
  {
    id: "slide-3",
    title: "Kids Explorer",
    subtitle: "For the Little Adventurers.",
    tags: ["Kids", "Footwear", "Accessories"],
    mediaUrl: "https://placehold.co/960x600/e5e7eb/000000?text=Kids+Image",
    mediaType: "image",
    layout: "left",
  },
  {
    id: "slide-4",
    title: "Emergency Gear",
    subtitle: "Always Be Prepared.",
    tags: ["Gear", "Survival", "Kits"],
    mediaUrl: "https://placehold.co/960x600/e5e7eb/000000?text=Gear+Image",
    mediaType: "image",
    layout: "right",
  },
];

// hook
export function useHeroBannerConfig() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => setCurrentIndex(index);

  return {
    slides: MOCK_SLIDES,
    currentIndex,
    currentSlide: MOCK_SLIDES[currentIndex],
    goToSlide,
  };
}
