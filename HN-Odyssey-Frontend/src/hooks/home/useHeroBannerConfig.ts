import { useState, useEffect } from "react";
import axiosClient from "../../api/axiosClient";

export interface SlideData {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  mediaUrl: string;
  mediaType: "image" | "video";
  layout: "left" | "right";
  targetUrl: string;
}

type BEBannerItem = {
  _id: string;
  title: string;
  image_pc: string;
  link?: string; // Đã fix: Bổ sung khai báo thuộc tính link
};

// Helper format URL (tương tự hàm bạn đã viết ở useProductList)
const getFullImageUrl = (url?: string): string => {
  if (!url) return "https://placehold.co/960x600/e5e7eb/000000?text=No+Image";
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

export function useHeroBannerConfig() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([]);

  useEffect(() => {
    const fetchHeroBanners = async () => {
      try {
        const res = await axiosClient.get<{ data: BEBannerItem[] }>(
          "/marketing/content/banners/public/active",
          {
            params: { position: "hero_banner" },
          },
        );

        const banners = res.data?.data || [];

        if (banners.length > 0) {
          const mappedSlides: SlideData[] = banners.map((b, index) => ({
            id: b._id,
            title: b.title || "Khám phá H&N Odyssey",
            subtitle: "Sẵn sàng cho mọi chuyến đi", // Fallback text do DB ko có trường này
            tags: ["New Arrivals", "Trending"], // Fallback tags
            mediaUrl: getFullImageUrl(b.image_pc),
            mediaType: (b.image_pc.match(/\.(mp4|webm)$/i)
              ? "video"
              : "image") as "video" | "image",
            layout: index % 2 === 0 ? "left" : "right",
            targetUrl: b.link || "/products",
          }));
          setSlides(mappedSlides);
        } else {
          // Fallback an toàn nếu Admin chưa tạo banner nào
          setSlides([
            {
              id: "fallback-hero",
              title: "Welcome to H&N Odyssey",
              subtitle: "Guided by the pull of open trails",
              tags: ["Welcome"],
              mediaUrl:
                "https://placehold.co/960x600/e5e7eb/000000?text=Welcome",
              mediaType: "image",
              layout: "left",
              targetUrl: "/products", // Đã fix: Bổ sung targetUrl bị thiếu
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to load hero banners:", error);
      }
    };
    fetchHeroBanners();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goToSlide = (index: number) => setCurrentIndex(index);

  return {
    slides,
    currentIndex,
    currentSlide: slides[currentIndex] || slides[0],
    goToSlide,
  };
}
