import { useState, useEffect } from "react";

export interface ConfigElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style?: React.CSSProperties;
}

export interface SlideConfig {
  id: string;
  backgroundUrl: string;
  elements: ConfigElement[];
}

// mock data
const MOCK_SLIDES: SlideConfig[] = [
  {
    id: "slide-1",
    backgroundUrl: "https://placehold.co/1920x900/111827/ffffff?text=Slide+1",
    elements: [
      {
        id: "el-1",
        type: "heading",
        x: 81,
        y: 170,
        width: 382,
        height: 40,
        content: "Recommend for you",
        style: {
          fontFamily: "'Lexend Deca', sans-serif",
          fontSize: "32px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          margin: 0,
        },
      },
      {
        id: "el-2",
        type: "text",
        x: 81,
        y: 220,
        width: 300,
        height: 40,
        content: "Thoughtfully chosen to match your moment.",
        style: {
          fontFamily: "'Lexend', sans-serif",
          fontSize: "16px",
          fontWeight: 400,
          color: "rgba(255,255,255,0.9)",
          margin: 0,
        },
      },
      {
        id: "el-3",
        type: "button",
        x: 81,
        y: 290,
        width: 200,
        height: 50,
        content: "Explore",
        style: {
          backgroundColor: "#fff",
          borderRadius: "268px",
          border: "none",
          fontFamily: "'Lexend Deca', sans-serif",
          fontSize: "24px",
          fontWeight: 700,
          color: "#000",
          cursor: "pointer",
        },
      },
    ],
  },
  {
    id: "slide-2",
    backgroundUrl: "https://placehold.co/1920x900/374151/ffffff?text=Slide+2",
    elements: [
      {
        id: "el-4",
        type: "heading",
        x: 81,
        y: 220,
        width: 400,
        height: 40,
        content: "New Arrivals",
        style: {
          fontFamily: "'Lexend Deca', sans-serif",
          fontSize: "32px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          margin: 0,
        },
      },
    ],
  },
  {
    id: "slide-3",
    backgroundUrl:
      "https://placehold.co/1920x900/e5e7eb/000000?text=Empty+Slide+3",
    elements: [], // Trống rỗng
  },
  {
    id: "slide-4",
    backgroundUrl:
      "https://placehold.co/1920x900/e5e7eb/000000?text=Empty+Slide+4",
    elements: [], // Trống rỗng
  },
];

export function useJustForYouSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = MOCK_SLIDES.length;

  useEffect(() => {
    if (totalSlides <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(timer);
  }, [totalSlides]);

  const goToSlide = (index: number) => setCurrentIndex(index);

  return { slides: MOCK_SLIDES, currentIndex, goToSlide };
}
