import type { ConfigElement } from "./useJustForYouSlider";

export interface OtherHalfData {
  id: string;
  backgroundColor: string;
  elements: ConfigElement[];
}

// Mock data
const MOCK_OTHER_HALF_DATA: OtherHalfData = {
  id: "other-half-1",
  backgroundColor: "#ffffff",
  elements: [
    // left
    {
      id: "oh-img-left",
      type: "image",
      x: 0,
      y: 0,
      width: 960,
      height: 990,
      content: "https://placehold.co/960x990/e5e7eb/000000?text=Her+Image",
      style: { objectFit: "cover" },
    },
    {
      id: "oh-her-title",
      type: "heading",
      x: 640,
      y: 91,
      width: 260,
      height: 30,
      content: "Gifts for Her",
      style: {
        fontFamily: "'Lexend Deca', sans-serif",
        fontSize: "24px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "right",
      },
    },
    {
      id: "oh-her-desc",
      type: "text",
      x: 640,
      y: 126,
      width: 260,
      height: 15,
      content: "“A touch of beauty crafted just for her.”",
      style: {
        fontFamily: "'Lexend', sans-serif",
        fontSize: "12px",
        color: "#fff",
        textAlign: "right",
      },
    },
    {
      id: "oh-her-btn",
      type: "button",
      x: 810,
      y: 156,
      width: 90,
      height: 20,
      content: "DISCOVER",
      style: {
        fontFamily: "'Lexend', sans-serif",
        fontSize: "16px",
        fontWeight: 700,
        color: "#fff",
        background: "none",
        border: "none",
        textDecoration: "underline",
        cursor: "pointer",
      },
    },

    // right
    {
      id: "oh-img-right",
      type: "image",
      x: 960,
      y: 0,
      width: 960,
      height: 990,
      content: "https://placehold.co/960x990/374151/ffffff?text=Him+Image",
      style: { objectFit: "cover" },
    },
    {
      id: "oh-him-title",
      type: "heading",
      x: 970,
      y: 750,
      width: 300,
      height: 30,
      content: "Gifts for Him",
      style: {
        fontFamily: "'Lexend Deca', sans-serif",
        fontSize: "24px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "left",
      },
    },
    {
      id: "oh-him-desc",
      type: "text",
      x: 970,
      y: 785,
      width: 300,
      height: 15,
      content: "“Thoughtful picks made to match his moments.”",
      style: {
        fontFamily: "'Lexend', sans-serif",
        fontSize: "12px",
        color: "#fff",
        textAlign: "left",
      },
    },
    {
      id: "oh-him-btn",
      type: "button",
      x: 970,
      y: 815,
      width: 90,
      height: 20,
      content: "DISCOVER",
      style: {
        fontFamily: "'Lexend', sans-serif",
        fontSize: "16px",
        fontWeight: 700,
        color: "#fff",
        background: "none",
        border: "none",
        textDecoration: "underline",
        cursor: "pointer",
        padding: 0,
      },
    },
  ],
};

export function useOtherHalfConfig() {
  return {
    configData: MOCK_OTHER_HALF_DATA,
  };
}
