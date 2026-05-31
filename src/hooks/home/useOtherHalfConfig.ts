import type { SectionConfig } from "../portal/Communication/ContentConfig/useContentConfig";
import type { ConfigElement } from "./useJustForYouSlider";

export interface OtherHalfData {
  id: string;
  backgroundColor: string;
  elements: ConfigElement[];
}

const MOCK_OTHER_HALF_DATA: OtherHalfData = {
  id: "other-half-1",
  backgroundColor: "#ffffff",
  elements: [
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
  ],
};

export function useOtherHalfConfig(dbSection?: SectionConfig | null) {
  const configData: OtherHalfData =
    dbSection && dbSection.elements && dbSection.elements.length > 0
      ? {
          id: dbSection.id,
          backgroundColor: dbSection.backgroundUrl || "#ffffff",
          elements: dbSection.elements as unknown as ConfigElement[],
        }
      : MOCK_OTHER_HALF_DATA;

  return { configData };
}
